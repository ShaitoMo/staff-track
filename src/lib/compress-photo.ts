/** Browser-only. Long edge cap and JPEG quality: keeps a phone photo readable as proof at a few hundred KB. */
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;

export class UnreadablePhotoError extends Error {
    constructor() {
        super("Couldn't read that photo. Try taking it again with the camera.");
        this.name = "UnreadablePhotoError";
    }
}

/**
 * Shrinks a photo to at most MAX_EDGE_PX on its long edge and re-encodes it as JPEG. Re-encoding
 * also drops EXIF (including GPS) and turns HEIC into JPEG wherever the browser can decode HEIC;
 * where it can't, the photo is rejected here rather than by the server.
 */
export async function compressPhoto(file: Blob): Promise<Blob> {
    let bitmap: ImageBitmap;
    try {
        // the default orientation already honours EXIF rotation, so portrait photos stay upright
        bitmap = await createImageBitmap(file);
    } catch {
        throw new UnreadablePhotoError();
    }

    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (context === null) {
        bitmap.close();
        throw new UnreadablePhotoError();
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (blob === null) {
        throw new UnreadablePhotoError();
    }
    return blob;
}
