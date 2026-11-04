import { request } from "@/lib/api-client";
import type { CopyWeekResult } from "@/types/shift";
import type { ProposedShift, SaveScheduleRulesInput, ScheduleProposal, ScheduleRules } from "@/types/schedule-builder";

export async function proposeSchedule(branchId: number, weekStart: string, maxShiftsPerWeek: number): Promise<ScheduleProposal> {
    const res = await request("/api/schedule-builder/propose", {
        method: "POST",
        json: { branchId, weekStart, maxShiftsPerWeek },
    });
    return res.json();
}

export async function approveSchedule(
    branchId: number,
    weekStart: string,
    maxShiftsPerWeek: number,
    shifts: ProposedShift[],
): Promise<CopyWeekResult> {
    const res = await request("/api/schedule-builder/approve", {
        method: "POST",
        json: { branchId, weekStart, maxShiftsPerWeek, shifts },
    });
    return res.json();
}

export async function saveScheduleRules(input: SaveScheduleRulesInput): Promise<ScheduleRules> {
    const res = await request("/api/schedule-rules", { method: "PUT", json: input });
    return res.json();
}
