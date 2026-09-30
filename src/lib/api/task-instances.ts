import { request } from "@/lib/api-client";

/** Sends the photo as multipart; no Content-Type is set on purpose, so the browser adds the boundary. */
export async function completeInstance(instanceId: number, photo: File): Promise<void> {
    const body = new FormData();
    body.append("photo", photo);

    await request(`/api/task-instances/${instanceId}/complete`, { method: "PATCH", body });
}

export async function reviewInstance(instanceId: number, decision: "verified" | "rejected"): Promise<void> {
    await request(`/api/task-instances/${instanceId}/review`, { method: "PATCH", json: { decision } });
}
