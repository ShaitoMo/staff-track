import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Uploads live outside `public/`, so photo proof is not served as a static asset to anyone who
 * guesses a filename. Serving them will need a route that checks who is asking; that route does
 * not exist yet, and putting the directory under `public/` now would quietly make it unnecessary.
 */
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

/** Kept in step with the extension map below. */
const ALLOWED_MIME_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
};

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export class InvalidPhotoError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidPhotoError';
    }
}

/**
 * Confirms the upload's own bytes match the type it claims, since `file.type` is reported by the
 * client and is not proof of what was actually sent.
 */
function matchesDeclaredType(buffer: Buffer, mimeType: string): boolean {
    switch (mimeType) {
        case 'image/jpeg':
            return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        case 'image/png':
            return (
                buffer.length >= 8 &&
                buffer[0] === 0x89 &&
                buffer[1] === 0x50 &&
                buffer[2] === 0x4e &&
                buffer[3] === 0x47 &&
                buffer[4] === 0x0d &&
                buffer[5] === 0x0a &&
                buffer[6] === 0x1a &&
                buffer[7] === 0x0a
            );
        case 'image/webp':
            return (
                buffer.length >= 12 &&
                buffer.toString('ascii', 0, 4) === 'RIFF' &&
                buffer.toString('ascii', 8, 12) === 'WEBP'
            );
        case 'image/heic':
            // ISO base media file format: a 4-byte box size followed by an 'ftyp' box type
            return buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp';
        default:
            return false;
    }
}

/**
 * Writes an uploaded photo to disk and returns the path recorded in media.file_path.
 *
 * The name is generated, never taken from the upload: a client-supplied filename could contain
 * path separators and escape the upload directory.
 */
export async function savePhoto(file: File, instanceId: number): Promise<string> {
    const extension = ALLOWED_MIME_TYPES[file.type];

    if (!extension) {
        throw new InvalidPhotoError(
            `Unsupported photo type '${file.type || 'unknown'}'. Allowed: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`,
        );
    }

    if (file.size === 0) {
        throw new InvalidPhotoError('Photo is empty');
    }

    if (file.size > MAX_PHOTO_BYTES) {
        throw new InvalidPhotoError(`Photo exceeds the ${MAX_PHOTO_BYTES / (1024 * 1024)}MB limit`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!matchesDeclaredType(buffer, file.type)) {
        throw new InvalidPhotoError(`File content does not match the declared type '${file.type}'`);
    }

    await mkdir(UPLOAD_ROOT, { recursive: true });

    const fileName = `instance-${instanceId}-${Date.now()}-${randomUUID()}.${extension}`;

    await writeFile(path.join(UPLOAD_ROOT, fileName), buffer);

    // stored as a URL-style path, matching the existing media rows
    return `/uploads/${fileName}`;
}

/** Best-effort cleanup for a photo that was written to disk but never made it into the database. */
export async function deletePhoto(filePath: string): Promise<void> {
    try {
        await unlink(path.join(UPLOAD_ROOT, path.basename(filePath)));
    } catch (error) {
        console.error(`Failed to clean up orphaned photo '${filePath}'`, error);
    }
}
