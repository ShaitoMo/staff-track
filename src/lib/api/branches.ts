import { request } from "@/lib/api-client";
import type { BranchUpdateInput, CreateBranchInput } from "@/types/branch";

export async function createBranch(input: CreateBranchInput): Promise<void> {
    await request("/api/branches", { method: "POST", json: input });
}

export async function updateBranch(branchId: number, input: BranchUpdateInput): Promise<void> {
    await request(`/api/branches/${branchId}`, { method: "PATCH", json: input });
}
