import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MAX_PHOTO_BYTES } from '@/lib/photo-limits';
import { logger } from '@/lib/logger';

/**
 * Photos live in a private Cloudflare R2 bucket, reached through its S3-compatible API. The bucket
 * is never public: the browser uploads with a short-lived signed PUT URL, and a photo is viewed only
 * through GET /api/media/:mediaId/file, which checks who is asking and then hands out a short-lived
 * signed GET URL. media.file_path holds the object key, not a URL.
 */

/** The browser compresses every photo to JPEG before upload, so that is the only type stored. */
const PHOTO_CONTENT_TYPE = 'image/jpeg';

/**
 * A signed PUT URL can be reused until it expires, so the upload URL is kept just long enough for one
 * upload: that narrows the window to overwrite a photo after verifyUploadedPhoto has passed it.
 */
const UPLOAD_URL_TTL_SECONDS = 60;

/** How long a signed view URL stays valid. */
const VIEW_URL_TTL_SECONDS = 5 * 60;

export class InvalidPhotoError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidPhotoError';
    }
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set`);
    }
    return value;
}

let client: S3Client | null = null;

/** Built on first use, so importing this module (e.g. in tests) does not require the R2 env vars. */
function r2(): S3Client {
    client ??= new S3Client({
        region: 'auto',
        endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
            secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
        },
    });
    return client;
}

function bucket(): string {
    return requireEnv('R2_BUCKET');
}

function keyPrefix(instanceId: number): string {
    return `task-instances/${instanceId}/`;
}

/**
 * A signed URL the browser PUTs the compressed photo to. The key is generated here, never taken from
 * the client. R2 does not enforce the signed content type on the PUT, so verifyUploadedPhoto is
 * what actually guarantees a stored photo is a JPEG.
 */
export async function createPhotoUploadUrl(instanceId: number): Promise<{ key: string; uploadUrl: string }> {
    const key = `${keyPrefix(instanceId)}${randomUUID()}.jpg`;
    const uploadUrl = await getSignedUrl(
        r2(),
        new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: PHOTO_CONTENT_TYPE }),
        { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return { key, uploadUrl };
}

/**
 * Confirms a key the client claims to have uploaded belongs to this instance and really is in the
 * bucket as a JPEG within the size limit. A signed PUT cannot cap the body size, so an oversized
 * upload is caught here and deleted.
 */
export async function verifyUploadedPhoto(key: string, instanceId: number): Promise<void> {
    if (!key.startsWith(keyPrefix(instanceId))) {
        throw new InvalidPhotoError('That photo does not belong to this task');
    }

    let head;
    try {
        head = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    } catch (error) {
        if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
            throw new InvalidPhotoError('The photo was not uploaded');
        }
        throw error;
    }

    const size = head.ContentLength ?? 0;

    if (head.ContentType !== PHOTO_CONTENT_TYPE || size === 0 || size > MAX_PHOTO_BYTES) {
        await deletePhoto(key);
        throw new InvalidPhotoError(
            `Photo must be a JPEG of at most ${MAX_PHOTO_BYTES / (1024 * 1024)}MB`,
        );
    }
}

/**
 * A short-lived signed URL to view a stored photo. Call only after the caller's access is checked.
 * The response type is forced to JPEG, so even an object overwritten after verification can never
 * be served as HTML or anything else the browser would act on.
 */
export async function getPhotoViewUrl(key: string): Promise<string> {
    return getSignedUrl(
        r2(),
        new GetObjectCommand({
            Bucket: bucket(),
            Key: key,
            ResponseContentType: PHOTO_CONTENT_TYPE,
            ResponseContentDisposition: 'inline',
        }),
        { expiresIn: VIEW_URL_TTL_SECONDS },
    );
}

/** Best-effort cleanup for a photo that was uploaded but never made it into the database. */
export async function deletePhoto(key: string): Promise<void> {
    try {
        await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    } catch (error) {
        logger.error({ err: error, key }, 'Failed to clean up orphaned photo');
    }
}
