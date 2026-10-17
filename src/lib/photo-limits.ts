/** Kept apart from storage.ts, which pulls in the S3 client and so should not be bundled into a client component. */
// the browser compresses photos to a few hundred KB, so this is only a safety cap
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
