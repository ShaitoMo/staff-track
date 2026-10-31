import { PhotoUploadError, request } from "@/lib/api-client";
import { compressPhoto, THUMB_EDGE_PX } from "@/lib/compress-photo";
import type {
    BranchSectionView,
    CreateSectionTypeInput,
    DeactivationImpact,
    GuideFolderView,
    GuideImageView,
    GuideUploadView,
    ReactivationImpact,
    UpdateSectionTypeInput,
} from "@/types/shelf-guide";

/**
 * The browser makes both files: the photo compressed to a JPEG, and a small JPEG thumbnail for the
 * grid. Both go straight to the bucket with the signed URLs; the returned keys are then confirmed.
 */
async function uploadPhotoPair(branchSectionId: number, file: Blob): Promise<{ photoKey: string; thumbKey: string }> {
    // the thumbnail comes from the 1600px JPEG, not the original, so a 12MP camera photo is decoded once
    const photo = await compressPhoto(file);
    const thumb = await compressPhoto(photo, THUMB_EDGE_PX);

    const res = await request(`/api/branch-sections/${branchSectionId}/guide-images/photo-upload`, { method: "POST" });
    const upload: GuideUploadView = await res.json();

    const put = (url: string, body: Blob) =>
        fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body }).catch(() => null);
    const results = await Promise.all([put(upload.photo.uploadUrl, photo), put(upload.thumb.uploadUrl, thumb)]);

    // a network or CORS failure rejects instead of returning a response, so treat both alike
    if (results.some((result) => result === null || !result.ok)) {
        throw new PhotoUploadError();
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

export async function updateGuidePhotoTitle(imageId: number, title: string): Promise<void> {
    await request(`/api/guide-images/${imageId}`, { method: "PATCH", json: { title } });
}

export async function deleteGuidePhoto(imageId: number): Promise<void> {
    await request(`/api/guide-images/${imageId}`, { method: "DELETE" });
}

export async function reorderGuidePhotos(branchSectionId: number, folderId: number | null, imageIds: number[]): Promise<void> {
    const query = folderId === null ? "" : `?folderId=${folderId}`;
    await request(`/api/branch-sections/${branchSectionId}/guide-images/order${query}`, { method: "PUT", json: { imageIds } });
}

// ---------- catalogue, sections, folders ----------

/** The branch's active sections. */
export async function getBranchSections(branchId: number): Promise<BranchSectionView[]> {
    return (await request(`/api/branches/${branchId}/sections`)).json();
}

/** Every active folder in the section, at any depth, for a picker that names each by its path. */
export async function getFolderTree(branchSectionId: number): Promise<GuideFolderView[]> {
    return (await request(`/api/branch-sections/${branchSectionId}/folders?all=true`)).json();
}

export async function createSectionType(input: CreateSectionTypeInput): Promise<void> {
    await request("/api/section-types", { method: "POST", json: input });
}

export async function updateSectionType(sectionTypeId: number, input: UpdateSectionTypeInput): Promise<void> {
    await request(`/api/section-types/${sectionTypeId}`, { method: "PATCH", json: input });
}

export async function createSection(branchId: number, sectionTypeId: number): Promise<void> {
    await request(`/api/branches/${branchId}/sections`, { method: "POST", json: { sectionTypeId } });
}

export async function createFolder(branchSectionId: number, name: string, parentFolderId: number | null): Promise<void> {
    await request(`/api/branch-sections/${branchSectionId}/folders`, { method: "POST", json: { name, parentFolderId } });
}

export async function renameFolder(folderId: number, name: string): Promise<void> {
    await request(`/api/folders/${folderId}`, { method: "PATCH", json: { name } });
}

/** Sections and folders share deactivate / reactivate / impact routes under their own base path. */
export type GuideNode = { kind: "section"; id: number } | { kind: "folder"; id: number };

const nodePath = (node: GuideNode) => (node.kind === "section" ? `/api/branch-sections/${node.id}` : `/api/folders/${node.id}`);

export async function getDeactivationImpact(node: GuideNode): Promise<DeactivationImpact> {
    return (await request(`${nodePath(node)}/deactivation-impact`)).json();
}

export async function getReactivationImpact(node: GuideNode): Promise<ReactivationImpact> {
    return (await request(`${nodePath(node)}/reactivation-impact`)).json();
}

export async function deactivateNode(node: GuideNode): Promise<void> {
    await request(nodePath(node), { method: "DELETE" });
}

export async function reactivateNode(node: GuideNode): Promise<void> {
    await request(`${nodePath(node)}/reactivate`, { method: "POST" });
}
