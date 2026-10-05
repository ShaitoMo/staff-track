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

/**
 * The mirror of EARLY_ARRIVAL_WINDOW_MINUTES for a punch with no clock-in: how long after a shift
 * ends its clock-out can still be counted as leaving it.
 */
export const LATE_DEPARTURE_WINDOW_MINUTES = 120;

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
    now = new Date(),
): ScheduleVsActualRow[] {
    const byWorkplace = groupByWorkplace(punches);
    const scheduled = shifts
        .map((shift) => ({
            shift,
            startAt: scheduledInstant(shift.shift_date, shift.start_time),
            endAt: scheduledInstant(shift.shift_date, shift.end_time),
        }))
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
    const outOnlyOwners = assignOutOnlyPunches(scheduled, punches);

    return scheduled.map((shift) => {
        const bucket = byWorkplace.get(workplaceKey(shift.shift.user_id, shift.shift.branch_id)) ?? [];

        return toRow(shift, bucket.filter((punch) => matches(punch, shift, outOnlyOwners)), now);
    });
}

/**
 * Whether a clock-out with no clock-in could be someone leaving this shift: after it started, and
 * no later than LATE_DEPARTURE_WINDOW_MINUTES after it ended. Also what the import uses to decide
 * which day such a clock-out fell on.
 */
export function couldEndShift(clockOut: Date, startAt: Date, endAt: Date): boolean {
    return clockOut.getTime() > startAt.getTime()
        && clockOut.getTime() <= endAt.getTime() + LATE_DEPARTURE_WINDOW_MINUTES * MS_PER_MINUTE;
}

/**
 * Which shift each clock-out-only punch belongs to, by attendance_id. One shift at most — a single
 * missed clock-in must not flag two back-to-back shifts. The shift the clock-out falls inside
 * wins; failing that, the latest-ending one it could have been leaving late from.
 */
function assignOutOnlyPunches(scheduled: ScheduledShift[], punches: AttendanceView[]): Map<number, number> {
    const owners = new Map<number, number>();

    for (const punch of punches) {
        if (punch.clock_in !== null) continue;

        const clockOut = punch.clock_out!;
        const candidates = scheduled.filter(({ shift, startAt, endAt }) =>
            shift.user_id === punch.user_id
            && shift.branch_id === punch.branch_id
            && couldEndShift(clockOut, startAt, endAt));
        const inside = candidates.find(({ endAt }) => clockOut.getTime() <= endAt.getTime());
        const owner = inside ?? candidates.at(-1);

        if (owner) {
            owners.set(punch.attendance_id, owner.shift.shift_id);
        }
    }

    return owners;
}

/** When a punch happened: its clock-in, or its clock-out when the clock-in is missing. */
function punchTime(punch: AttendanceView): number {
    // the schema's CHECK guarantees at least one end
    return (punch.clock_in ?? punch.clock_out)!.getTime();
}

/** Punches indexed by the pair that identifies a workplace, each bucket in time order. */
function groupByWorkplace(punches: AttendanceView[]): Map<string, AttendanceView[]> {
    const grouped = new Map<string, AttendanceView[]>();

    for (const punch of [...punches].sort((left, right) => punchTime(left) - punchTime(right))) {
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
 * one forgotten clock-out, so it falls back to "did they arrive for roughly this shift." A punch
 * with no clock-in belongs to the one shift `assignOutOnlyPunches` gave it.
 */
function matches(
    punch: AttendanceView,
    { shift, startAt, endAt }: ScheduledShift,
    outOnlyOwners: Map<number, number>,
): boolean {
    if (punch.clock_in === null) {
        return outOnlyOwners.get(punch.attendance_id) === shift.shift_id;
    }

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
 * departure would misreport leaving early. Arrival is only known when the first punch has a
 * clock-in, and a punch left open counts as a missing clock-out only once the shift has ended.
 */
function toRow(
    { shift, startAt, endAt }: ScheduledShift,
    matched: AttendanceView[],
    now: Date,
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
            incomplete_attendance_id: null,
            late_minutes: null,
            early_leave_minutes: null,
        };
    }

    const first = matched[0];
    const last = matched[matched.length - 1];
    const missingClockIn = matched.find((punch) => punch.clock_in === null);
    const missingClockOut = last.clock_out === null && now.getTime() >= endAt.getTime() ? last : undefined;

    const lateMinutes = first.clock_in === null ? null : minutesBetween(startAt, first.clock_in);
    const earlyLeaveMinutes = last.clock_out === null ? null : minutesBetween(last.clock_out, endAt);

    return {
        ...base,
        // the same punch late_minutes reads: a later clock-in (after a missed one) is not the arrival
        actual_clock_in: first.clock_in,
        actual_clock_out: last.clock_out,
        flag: missingClockIn ? 'missing_clock_in'
            : missingClockOut ? 'missing_clock_out'
            : flagFor(lateMinutes, earlyLeaveMinutes),
        incomplete_attendance_id: (missingClockIn ?? missingClockOut)?.attendance_id ?? null,
        late_minutes: lateMinutes,
        early_leave_minutes: earlyLeaveMinutes,
    };
}

function flagFor(lateMinutes: number | null, earlyLeaveMinutes: number | null): AttendanceFlag {
    if (lateMinutes !== null && lateMinutes > LATE_GRACE_MINUTES) {
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
