import { request } from "@/lib/api-client";
// type-only: the module behind this type pulls in the spreadsheet parser, which must stay off the client
import type { ImportAttendanceResult } from "@/types/attendance-import";

export interface ManualPunchInput {
    user_id: number;
    branch_id: number;
    clock_in: string;
    clock_out: string | null;
}

export async function createAttendance(input: ManualPunchInput): Promise<void> {
    await request("/api/attendance", { method: "POST", json: input });
}

/** Fills in the end of a punch the machine missed. */
export async function updateAttendance(
    attendanceId: number,
    input: { clock_in?: string; clock_out?: string },
): Promise<void> {
    await request(`/api/attendance/${attendanceId}`, { method: "PATCH", json: input });
}

/** No `json` here, so `request` leaves Content-Type to the browser and it sends the multipart boundary. */
export async function importAttendance(branchId: number, file: File): Promise<ImportAttendanceResult> {
    const body = new FormData();
    body.set("branch_id", String(branchId));
    body.set("file", file);

    const res = await request("/api/attendance/import", { method: "POST", body });
    return res.json();
}
