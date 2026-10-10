import { request } from "@/lib/api-client";

/** Times as the form holds them, 'HH:MM'; the API parses them. `branchId: null` is a chain-wide period. */
export interface PeriodInput {
    branchId: number | null;
    name: string;
    defaultStart: string;
    defaultEnd: string;
    sortOrder: number;
}

export async function createPeriod(input: PeriodInput): Promise<void> {
    await request("/api/periods", { method: "POST", json: input });
}

/** The branch can't change after creation, so an edit sends everything but it. */
export async function updatePeriod(periodId: number, input: Omit<PeriodInput, "branchId">): Promise<void> {
    await request(`/api/periods/${periodId}`, { method: "PATCH", json: input });
}

export async function setPeriodActive(periodId: number, active: boolean): Promise<void> {
    await request(`/api/periods/${periodId}`, { method: "PATCH", json: { active } });
}

export async function deletePeriod(periodId: number): Promise<void> {
    await request(`/api/periods/${periodId}`, { method: "DELETE" });
}
