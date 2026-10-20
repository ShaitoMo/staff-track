import { ApiError, request } from "@/lib/api-client";
import { compressPhoto, THUMB_EDGE_PX } from "@/lib/compress-photo";
import type { GuideImageView, GuideUploadView } from "@/types/shelf-guide";

/**
 * The browser makes both files: the photo compressed to a JPEG, and a small JPEG thumbnail for the
 * grid. Both go straight to the bucket with the signed URLs; the returned keys are then confirmed.
 */
async function uploadPhotoPair(branchSectionId: number, file: Blob): Promise<{ photoKey: string; thumbKey: string }> {
    const [photo, thumb] = await Promise.all([compressPhoto(file), compressPhoto(file, THUMB_EDGE_PX)]);

    const res = await request(`/api/branch-sections/${branchSectionId}/guide-images/photo-upload`, { method: "POST" });
    const upload: GuideUploadView = await res.json();

    const put = (url: string, body: Blob) =>
        fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body }).catch(() => null);
    const results = await Promise.all([put(upload.photo.uploadUrl, photo), put(upload.thumb.uploadUrl, thumb)]);

    // a network or CORS failure rejects instead of returning a response, so treat both alike
    if (results.some((result) => result === null || !result.ok)) {
        throw new ApiError("The photo didn't upload. Check your connection and try again.", 0);
    }

    return { photoKey: upload.photo.key, thumbKey: upload.thumb.key };
}

export async function addGuidePhoto(
    branchSectionId: number,
    file: Blob,
    options: { title?: string; folderId?: number | null } = {},
): Promise<GuideImageView> {
    const keys = await uploadPhotoPair(branchSectionId, file);
    const res = await request(`/api/branch-sections/${branchSectionId}/guide-images`, {
        method: "POST",
        json: { ...keys, ...options },
    });
    return res.json();
}

export async function replaceGuidePhoto(image: GuideImageView, file: Blob): Promise<GuideImageView> {
    const keys = await uploadPhotoPair(image.branchSectionId, file);
    const res = await request(`/api/guide-images/${image.imageId}`, { method: "PATCH", json: keys });
    return res.json();
}
