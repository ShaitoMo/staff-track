import { request } from "@/lib/api-client";
import type { CreateCoverageRequirementInput, UpdateCoverageRequirementInput } from "@/types/coverage-requirement";

export async function createRequirement(input: CreateCoverageRequirementInput): Promise<void> {
    await request("/api/coverage-requirements", { method: "POST", json: input });
}

export async function updateRequirement(requirementId: number, input: UpdateCoverageRequirementInput): Promise<void> {
    await request(`/api/coverage-requirements/${requirementId}`, { method: "PATCH", json: input });
}
