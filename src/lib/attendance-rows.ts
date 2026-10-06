import { MACHINE_TIME_ZONE, machineTimeToUtc } from "@/lib/machine-time";
import { scheduledInstant } from "@/lib/schedule-vs-actual";
import type { AttendanceFlag, ScheduleVsActualRow } from "@/types/schedule-vs-actual";

/**
 * The report's flag, plus `upcoming`: the API calls any shift without punches a no-show, but one
 * that hasn't started yet hasn't been missed.
 */
export type AttendanceStatus = AttendanceFlag | "upcoming";

/** In the order a manager reads them: what went right, what went wrong, then what's still ahead. */
export const STATUS_ORDER: AttendanceStatus[] = [
    "on_time",
    "late",
    "left_early",
    "missing_clock_in",
    "missing_clock_out",
    "no_show",
    "upcoming",
];

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
    on_time: "On time",
    late: "Late",
    left_early: "Left early",
    missing_clock_in: "Missing clock-in",
    missing_clock_out: "Missing clock-out",
    no_show: "No-show",
    upcoming: "Upcoming",
};

/** Which end of a punch the Fix dialog fills in, from the row's status. */
export type MissingEnd = "clock_in" | "clock_out";

const machineClock = new Intl.DateTimeFormat("en-GB", {
    timeZone: MACHINE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

/** 'HH:mm' on the branch's clock, so a punch reads the same whatever zone the viewer is in. */
export function formatMachineTime(instant: Date | string): string {
    return machineClock.format(new Date(instant));
}

/**
 * A hand-entered punch ('YYYY-MM-DD' plus 'HH:mm' times, read as branch wall-clock) as the ISO
 * instants POST /api/attendance expects. A clock-out at or before the clock-in is the next
 * morning — the same rule the machine import applies to a night shift.
 */
export function punchToIso(
    date: string,
    clockIn: string,
    clockOut?: string,
): { clock_in: string; clock_out: string | null } {
    const [year, month, day] = date.split("-").map(Number);
    const at = (time: string, dayOffset = 0) => {
        const [hours, minutes] = time.split(":").map(Number);
        return machineTimeToUtc(year, month, day + dayOffset, hours, minutes);
    };

    const opening = at(clockIn);

    if (!clockOut) {
        return { clock_in: opening.toISOString(), clock_out: null };
    }

    const closing = at(clockOut);

    return {
        clock_in: opening.toISOString(),
        clock_out: (closing > opening ? closing : at(clockOut, 1)).toISOString(),
    };
}

/**
 * The time a manager typed into the Fix dialog, as the instant PATCH /api/attendance/:id expects.
 * A clock-in falls on the shift's own date. A clock-out before the shift's scheduled start is the
 * next morning — an evening shift's 01:15 — as the dialog says. One exactly at the start stays on
 * the shift's date, where the server refuses it as not after the clock-in, rather than silently
 * becoming a 24-hour punch.
 */
export function fixTimeToIso(shiftDate: string, scheduledStart: string, time: string, end: MissingEnd): string {
    const [year, month, day] = shiftDate.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const nextDay = end === "clock_out" && time < scheduledStart.slice(0, 5) ? 1 : 0;

    return machineTimeToUtc(year, month, day + nextDay, hours, minutes).toISOString();
}

/**
 * How many shifts landed on each status; every status is present, zero included. A slip also
 * counts where the flag doesn't say it — a shift late and left early is under both, and a late
 * arrival with a missing clock-out is under late too — matching the dashboard's totals.
 */
export function summarizeStatuses(
    rows: Pick<AttendanceRow, "status" | "isLate" | "leftEarly">[],
): Record<AttendanceStatus, number> {
    const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<AttendanceStatus, number>;

    for (const row of rows) {
        counts[row.status] += 1;

        if (row.isLate && row.status !== "late") {
            counts.late += 1;
        }

        if (row.leftEarly && row.status !== "left_early") {
            counts.left_early += 1;
        }
    }

    return counts;
}

export interface AttendanceRow {
    shiftId: number;
    shiftDate: string;
    name: string;
    /** 'HH:mm', for the Fix dialog's next-morning rollover. */
    scheduledStart: string;
    scheduled: string;
    clockIn: string | null;
    clockOut: string | null;
    status: AttendanceStatus;
    /** The punch to fix and which end it is missing; null when the row needs no fixing. */
    fix: { attendanceId: number; end: MissingEnd } | null;
    /** 'Late 12 min · left 20 min early' — only the slips past the grace period; null when there are none. */
    detail: string | null;
    /** Arrived / left past the grace period, whatever the flag says. */
    isLate: boolean;
    leftEarly: boolean;
}

/** Joins names, formats times on the branch clock, and orders by day, start, then person. */
export function buildAttendanceRows(
    rows: ScheduleVsActualRow[],
    users: { userId: number; name: string }[],
    now = new Date(),
): AttendanceRow[] {
    const names = new Map(users.map((user) => [user.userId, user.name]));

    return rows
        .map((row) => ({
            shiftId: row.shift_id,
            shiftDate: row.shift_date,
            name: names.get(row.user_id) ?? `User ${row.user_id}`,
            scheduledStart: row.scheduled_start.slice(0, 5),
            scheduled: `${row.scheduled_start.slice(0, 5)}–${row.scheduled_end.slice(0, 5)}`,
            clockIn: row.actual_clock_in === null ? null : formatMachineTime(row.actual_clock_in),
            clockOut: row.actual_clock_out === null ? null : formatMachineTime(row.actual_clock_out),
            status: statusOf(row, now),
            fix: fixFor(row),
            detail: slipDetail(row),
            isLate: row.is_late,
            leftEarly: row.left_early,
        }))
        .toSorted(
            (a, b) =>
                // `scheduled` leads with the start time, so comparing it orders by start
                a.shiftDate.localeCompare(b.shiftDate) || a.scheduled.localeCompare(b.scheduled) || a.name.localeCompare(b.name),
        );
}

function statusOf(row: ScheduleVsActualRow, now: Date): AttendanceStatus {
    return row.flag === "no_show" && scheduledInstant(row.shift_date, row.scheduled_start) > now ? "upcoming" : row.flag;
}

function fixFor(row: ScheduleVsActualRow): AttendanceRow["fix"] {
    if (row.incomplete_attendance_id === null) return null;

    return {
        attendanceId: row.incomplete_attendance_id,
        end: row.flag === "missing_clock_in" ? "clock_in" : "clock_out",
    };
}

/** The minutes behind each slip; 0 for a slip within the grace period, or none. */
const lateBy = (row: ScheduleVsActualRow) => (row.is_late ? (row.late_minutes ?? 0) : 0);
const earlyBy = (row: ScheduleVsActualRow) => (row.left_early ? (row.early_leave_minutes ?? 0) : 0);

function slipDetail(row: ScheduleVsActualRow): string | null {
    const parts = [
        row.is_late ? `${lateBy(row)} min late` : null,
        row.left_early ? `left ${earlyBy(row)} min early` : null,
    ].filter((part) => part !== null);

    return parts.length === 0 ? null : parts.join(" · ");
}

/**
 * Minutes lost to arriving late and leaving early — the same slips each row's detail shows.
 * No-shows aren't counted, and neither is a shift with a missing punch: its times aren't settled
 * until a manager adds the punch, and the page tells staff it isn't counted yet.
 */
export function missedMinutes(rows: ScheduleVsActualRow[]): number {
    return rows
        .filter((row) => row.incomplete_attendance_id === null)
        .reduce((total, row) => total + lateBy(row) + earlyBy(row), 0);
}

/** '45 min', '1 h', '1 h 17 min'. */
export function formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours === 0) return `${rest} min`;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
