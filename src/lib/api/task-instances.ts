import { PhotoUploadError, request } from "@/lib/api-client";
import type { GuideImageView } from "@/types/shelf-guide";
import type { PhotoUploadView } from "@/types/task-instance";

/**
 * Three steps: get a signed upload URL, PUT the (already compressed) JPEG straight to the bucket,
 * then complete the instance with the key. The PUT is cross-origin, so it uses plain fetch rather
 * than `request`, and must send the exact Content-Type the URL was signed for.
 */
export async function completeInstance(instanceId: number, photo: Blob): Promise<void> {
    const res = await request(`/api/task-instances/${instanceId}/photo-upload`, { method: "POST" });
    const { key, upload_url }: PhotoUploadView = await res.json();

    // a network or CORS failure rejects instead of returning a response, so treat both alike
    const upload = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: photo })
        .catch(() => null);
    if (upload === null || !upload.ok) {
        throw new PhotoUploadError(upload?.status ?? 0);
    }

    await request(`/api/task-instances/${instanceId}/complete`, { method: "PATCH", json: { photo_key: key } });
}

export async function reviewInstance(instanceId: number, decision: "verified" | "rejected"): Promise<void> {
    await request(`/api/task-instances/${instanceId}/review`, { method: "PATCH", json: { decision } });
}

/** The shelf-guide photos showing how the task should look; `[]` when it has none. */
export async function getTaskReference(instanceId: number): Promise<GuideImageView[]> {
    return (await request(`/api/task-instances/${instanceId}/reference`)).json();
}
