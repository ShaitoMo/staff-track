import { request } from "@/lib/api-client";
import type { SafeUser, UpdateUserInput, User } from "@/types/user";
import type { UserBranch } from "@/types/user-branch";

export async function createUser(input: User): Promise<SafeUser> {
    const res = await request("/api/users", { method: "POST", json: input });
    return res.json();
}

export async function updateUser(userId: number, input: UpdateUserInput): Promise<void> {
    await request(`/api/users/${userId}`, { method: "PATCH", json: input });
}

/** Change password: your own, proven with the current one. The response sets fresh cookies for this device. */
export async function changeOwnPassword(userId: number, currentPassword: string, password: string): Promise<void> {
    await request(`/api/users/${userId}/password`, { method: "PUT", json: { currentPassword, password } });
}

/** Reset password: someone else's, set by an owner or manager. */
export async function resetPassword(userId: number, password: string): Promise<void> {
    await request(`/api/users/${userId}/password`, { method: "PUT", json: { password } });
}

export async function linkUserBranch(input: UserBranch): Promise<void> {
    await request("/api/user-branches", { method: "POST", json: input });
}

export async function unlinkUserBranch(userId: number, branchId: number): Promise<void> {
    await request(`/api/user-branches/${userId}/${branchId}`, { method: "DELETE" });
}
