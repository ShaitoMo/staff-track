import { AttendanceView } from '@/types/attendance';
import { AttendanceFlag, ScheduleVsActualRow } from '@/types/schedule-vs-actual';
import { ShiftView } from '@/types/shift';
import { machineTimeToUtc } from '@/lib/machine-time';

const MS_PER_MINUTE = 60 * 1000;

/**
 * How far either end of a shift may slip before the row stops reading as `on_time`.
 *
 * A constant, not a column and not a query parameter: per-branch policy is a schema question for
 * the day it is asked, and a tunable would let the report be re-run until the numbers look good.
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
 * The instant a wall-clock shift time actually happened.
 *
 * `shift_date` and the two times are naive — Postgres `date` and `time` carry no zone — while
 * attendance is `timestamptz`, a real instant. The two can only be compared through the zone the
 * clock machines stand in, which is the same conversion the CSV import does on the way in.
 */
export function scheduledInstant(shiftDate: string, timeOfDay: string): Date {
    const [year, month, day] = shiftDate.split('-').map(Number);
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    return machineTimeToUtc(year, month, day, hours, minutes);
}

/**
 * Every scheduled shift against the punches recorded around it (FR6).
 *
 * A punch is a *presence interval*, not an arrival instant, and one interval can cover more than
 * one shift — which is what a split day is. Nothing is consumed: an earlier design marked each
 * punch as spent so no two shifts could claim it, and a man who worked 09:00-21:00 on one punch had
 * his evening shift reported as a no-show. Overlap draws the distinction that consumption was
 * reaching for, without inventing an absence.
 *
 * `punches` must already be narrowed to the same people and branches as `shifts`, over a window a
 * little wider than the report's own — a shift late on the last day ends after that day does.
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
 * Whether the worker was present for any part of this shift.
 *
 * A closed punch is a plain interval overlap, strict at both ends: a punch that ends exactly when a
 * shift begins covers none of it, the same half-open convention `getOverlappingShifts` uses when it
 * decides two shifts are back-to-back rather than clashing.
 *
 * An open punch has no known end. Treating it as presence-until-further-notice would mark every
 * later shift attended on the strength of one forgotten clock-out, so it falls back to the question
 * an arrival can answer on its own: did they turn up for roughly this shift.
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
 * The comparison itself.
 *
 * `actual_clock_out` comes from the last punch of the shift rather than the latest clock-out
 * recorded: someone who went to lunch and never clocked out again is still inside the building,
 * and reporting the lunch departure would read as leaving early.
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
