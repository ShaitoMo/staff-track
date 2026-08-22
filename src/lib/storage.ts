import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
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

    await mkdir(UPLOAD_ROOT, { recursive: true });

    const fileName = `instance-${instanceId}-${Date.now()}-${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await writeFile(path.join(UPLOAD_ROOT, fileName), buffer);

    // stored as a URL-style path, matching the existing media rows
    return `/uploads/${fileName}`;
}
