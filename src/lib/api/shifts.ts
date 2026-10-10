import { request } from "@/lib/api-client";
import type { CopyWeekResult } from "@/types/shift";

/** Times come from the period, so the schedule never sends its own. */
export interface ScheduleShiftInput {
    user_id: number;
    branch_id: number;
    period_id: number;
    shift_date: string;
    register_id?: number;
}

export async function createShift(input: ScheduleShiftInput): Promise<void> {
    await request("/api/shifts", { method: "POST", json: input });
}

export async function setShiftRegister(shiftId: number, registerId: number | null): Promise<void> {
    await request(`/api/shifts/${shiftId}`, { method: "PATCH", json: { register_id: registerId } });
}

export async function deleteShift(shiftId: number): Promise<void> {
    await request(`/api/shifts/${shiftId}`, { method: "DELETE" });
}

export async function copyWeek(branchId: number, weekStart: string): Promise<CopyWeekResult> {
    const res = await request("/api/shifts/copy-week", {
        method: "POST",
        json: { branch_id: branchId, week_start: weekStart },
    });
    return res.json();
}
