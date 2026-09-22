import { AttendanceView } from '@/types/attendance';
import { AttendanceFlag, ScheduleVsActualRow } from '@/types/schedule-vs-actual';
import { ShiftView } from '@/types/shift';
import { machineTimeToUtc } from '@/lib/machine-time';

const MS_PER_MINUTE = 60 * 1000;

/**
 * How far either end of a shift may slip before it stops reading as `on_time`. A constant, not a
 * column or query param — a tunable would let the report be re-run until the numbers look good.
 */
export const LATE_GRACE_MINUTES = 5;

/**
 * How long before a shift starts an *open* punch can still be counted as arriving for it. Only
 * open punches need this bound — see `matches`.
 */
export const EARLY_ARRIVAL_WINDOW_MINUTES = 120;

/** A shift with its wall-clock times resolved to the instants they actually happened. */
interface ScheduledShift {
    shift: ShiftView;
    startAt: Date;
    endAt: Date;
}

/**
 * The instant a wall-clock shift time actually happened. `shift_date`/times are naive (no zone),
 * while attendance is `timestamptz` — comparable only through the machines' zone, same conversion
 * the CSV import uses.
 */
export function scheduledInstant(shiftDate: string, timeOfDay: string): Date {
    const [year, month, day] = shiftDate.split('-').map(Number);
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    return machineTimeToUtc(year, month, day, hours, minutes);
}

/**
 * Every scheduled shift against the punches recorded around it (FR6). A punch is a *presence
 * interval*, not an arrival instant, and one interval can cover more than one shift (a split day)
 * — nothing is consumed, since an earlier "mark as spent" design falsely no-showed shifts covered
 * by one long punch. `punches` must already be narrowed to `shifts`' people/branches, over a
 * window a little wider than the report's own.
 */
export function compareScheduleWithAttendance(
    shifts: ShiftView[],
    punches: AttendanceView[],
): ScheduleVsActualRow[] {
    const byWorkplace = groupByWorkplace(punches);

    return shifts
        .map((shift) => ({
            shift,
            startAt: scheduledInstant(shift.shift_date, shift.start_time),
            endAt: scheduledInstant(shift.shift_date, shift.end_time),
        }))
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
        .map((scheduled) => {
            const bucket = byWorkplace.get(
                workplaceKey(scheduled.shift.user_id, scheduled.shift.branch_id),
            ) ?? [];

            return toRow(scheduled, bucket.filter((punch) => matches(punch, scheduled)));
        });
}

/** Punches indexed by the pair that identifies a workplace, each bucket in clock-in order. */
function groupByWorkplace(punches: AttendanceView[]): Map<string, AttendanceView[]> {
    const grouped = new Map<string, AttendanceView[]>();

    for (const punch of [...punches].sort(
        (left, right) => left.clock_in.getTime() - right.clock_in.getTime(),
    )) {
        const key = workplaceKey(punch.user_id, punch.branch_id);
        const bucket = grouped.get(key);

        if (bucket) {
            bucket.push(punch);
        } else {
            grouped.set(key, [punch]);
        }
    }

    return grouped;
}

function workplaceKey(userId: number, branchId: number): string {
    return `${userId}:${branchId}`;
}

/**
 * Whether the worker was present for any part of this shift. A closed punch is a strict interval
 * overlap (half-open, same convention as `getOverlappingShifts`). An open punch has no known end —
 * treating it as presence-until-further-notice would falsely mark every later shift attended off
 * one forgotten clock-out, so it falls back to "did they arrive for roughly this shift."
 */
function matches(punch: AttendanceView, { startAt, endAt }: ScheduledShift): boolean {
    const clockIn = punch.clock_in.getTime();

    if (clockIn >= endAt.getTime()) {
        return false;
    }

    if (punch.clock_out === null) {
        return clockIn >= startAt.getTime() - EARLY_ARRIVAL_WINDOW_MINUTES * MS_PER_MINUTE;
    }

    return punch.clock_out.getTime() > startAt.getTime();
}

/**
 * The comparison itself. `actual_clock_out` is the last punch's clock-out, not the latest
 * recorded — someone who never clocked back in from lunch is still inside, and using that
 * departure would misreport leaving early.
 */
function toRow(
    { shift, startAt, endAt }: ScheduledShift,
    matched: AttendanceView[],
): ScheduleVsActualRow {
    const base = {
        shift_id: shift.shift_id,
        user_id: shift.user_id,
        branch_id: shift.branch_id,
        shift_date: shift.shift_date,
        scheduled_start: shift.start_time,
        scheduled_end: shift.end_time,
    };

    if (matched.length === 0) {
        return {
            ...base,
            actual_clock_in: null,
            actual_clock_out: null,
            flag: 'no_show',
            late_minutes: null,
            early_leave_minutes: null,
        };
    }

    const clockIn = matched[0].clock_in;
    const clockOut = matched[matched.length - 1].clock_out;
    const lateMinutes = minutesBetween(startAt, clockIn);
    const earlyLeaveMinutes = clockOut === null ? null : minutesBetween(clockOut, endAt);

    return {
        ...base,
        actual_clock_in: clockIn,
        actual_clock_out: clockOut,
        flag: flagFor(lateMinutes, earlyLeaveMinutes),
        late_minutes: lateMinutes,
        early_leave_minutes: earlyLeaveMinutes,
    };
}

function flagFor(lateMinutes: number, earlyLeaveMinutes: number | null): AttendanceFlag {
    if (lateMinutes > LATE_GRACE_MINUTES) {
        return 'late';
    }

    if (earlyLeaveMinutes !== null && earlyLeaveMinutes > LATE_GRACE_MINUTES) {
        return 'left_early';
    }

    return 'on_time';
}

/** Whole minutes from `from` to `to`, rounded — punches carry seconds the report has no use for. */
function minutesBetween(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / MS_PER_MINUTE);
}
