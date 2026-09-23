import { request } from "@/lib/api-client";
import type { Branch, BranchUpdateInput, CreateBranchInput } from "@/types/branch";

export async function createBranch(input: CreateBranchInput): Promise<Branch> {
    const res = await request("/api/branches", { method: "POST", json: input });
    return res.json();
}

export async function updateBranch(branchId: number, input: BranchUpdateInput): Promise<Branch> {
    const res = await request(`/api/branches/${branchId}`, { method: "PATCH", json: input });
    return res.json();
}
