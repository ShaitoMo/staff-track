import {
    compareScheduleWithAttendance,
    scheduledInstant,
    EARLY_ARRIVAL_WINDOW_MINUTES,
    LATE_DEPARTURE_WINDOW_MINUTES,
    LATE_GRACE_MINUTES,
} from '@/lib/schedule-vs-actual';
import { AttendanceView } from '@/types/attendance';
import { ShiftView } from '@/types/shift';

const EPOCH = new Date('1970-01-01T00:00:00.000Z');

/**
 * Every fixture sits on 2026-07-01, when Beirut is +03:00. The local times that recur:
 *   09:00 -> 06:00Z   12:00 -> 09:00Z   17:00 -> 14:00Z   21:00 -> 18:00Z
 */
let nextShiftId = 1;
let nextAttendanceId = 1;

beforeEach(() => {
    nextShiftId = 1;
    nextAttendanceId = 1;
});

function shift(overrides: Partial<ShiftView> = {}): ShiftView {
    return {
        shift_id: nextShiftId++,
        user_id: 1,
        branch_id: 1,
        register_id: null,
        period_id: null,
        shift_date: '2026-07-01',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 99,
        created_at: EPOCH,
        updated_at: EPOCH,
        ...overrides,
    };
}

/** A punch, given as the instants it happened — the columns are `timestamptz`. */
function punch(
    clockIn: string,
    clockOut: string | null,
    overrides: Partial<AttendanceView> = {},
): AttendanceView {
    return {
        attendance_id: nextAttendanceId++,
        user_id: 1,
        branch_id: 1,
        clock_in: new Date(clockIn),
        clock_out: clockOut === null ? null : new Date(clockOut),
        source: 'csv_import',
        import_batch_id: null,
        ...overrides,
    };
}

/** 11:00 on the fixture day — the morning shift is under way, so an open punch is still current. */
const MID_SHIFT = new Date('2026-07-01T08:00:00Z');

const morning = () => shift({ start_time: '09:00', end_time: '17:00' });
const evening = () => shift({ start_time: '17:00', end_time: '21:00' });

describe('scheduledInstant', () => {
    // Beirut is +03:00 in summer and +02:00 in winter, so the same wall-clock time is a different
    // instant depending on the date — a converter that hardcodes an offset passes only one of these.
    it('resolves a summer shift time through the machine timezone', () => {
        expect(scheduledInstant('2026-07-01', '09:00').toISOString()).toBe('2026-07-01T06:00:00.000Z');
    });

    it('resolves a winter shift time through the machine timezone', () => {
        expect(scheduledInstant('2026-01-15', '09:00').toISOString()).toBe('2026-01-15T07:00:00.000Z');
    });
});

describe('compareScheduleWithAttendance - flags', () => {
    it('flags a punctual shift on_time with the punches it matched', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:00:00Z', '2026-07-01T14:00:00Z')],
        );

        expect(row).toMatchObject({
            shift_id: 1,
            shift_date: '2026-07-01',
            scheduled_start: '09:00',
            scheduled_end: '17:00',
            flag: 'on_time',
            late_minutes: 0,
            early_leave_minutes: 0,
        });
        expect(row.actual_clock_in).toEqual(new Date('2026-07-01T06:00:00Z'));
        expect(row.actual_clock_out).toEqual(new Date('2026-07-01T14:00:00Z'));
    });

    it('flags a late arrival and says by how many minutes', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:23:00Z', '2026-07-01T14:00:00Z')],
        );

        expect(row.flag).toBe('late');
        expect(row.late_minutes).toBe(23);
    });

    it('leaves an arrival inside the grace period on_time', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch(`2026-07-01T06:0${LATE_GRACE_MINUTES}:00Z`, '2026-07-01T14:00:00Z')],
        );

        expect(row.flag).toBe('on_time');
        expect(row.late_minutes).toBe(LATE_GRACE_MINUTES);
    });

    it('reports an early arrival as negative minutes, not lateness', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T05:48:00Z', '2026-07-01T14:00:00Z')],
        );

        expect(row.flag).toBe('on_time');
        expect(row.late_minutes).toBe(-12);
    });

    it('flags leaving before the end of the shift', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:00:00Z', '2026-07-01T13:15:00Z')],
        );

        expect(row.flag).toBe('left_early');
        expect(row.early_leave_minutes).toBe(45);
    });

    it('reports staying past the end as negative minutes', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:00:00Z', '2026-07-01T14:30:00Z')],
        );

        expect(row.flag).toBe('on_time');
        expect(row.early_leave_minutes).toBe(-30);
    });

    it('names the arrival when a shift is both late and cut short', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:40:00Z', '2026-07-01T13:00:00Z')],
        );

        expect(row.flag).toBe('late');
        expect(row.late_minutes).toBe(40);
        expect(row.early_leave_minutes).toBe(60);
    });

    it('flags a shift with no punch at all as a no_show', () => {
        const [row] = compareScheduleWithAttendance([shift()], []);

        expect(row).toMatchObject({
            flag: 'no_show',
            actual_clock_in: null,
            actual_clock_out: null,
            late_minutes: null,
            early_leave_minutes: null,
        });
    });

    it('judges only the arrival while a shift is still open', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:00:00Z', null)],
            MID_SHIFT,
        );

        expect(row.flag).toBe('on_time');
        expect(row.actual_clock_out).toBeNull();
        expect(row.early_leave_minutes).toBeNull();
        expect(row.incomplete_attendance_id).toBeNull();
    });

    it('flags a punch still open after the shift ended as missing_clock_out, keeping the lateness', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:20:00Z', null, { attendance_id: 7 })],
            new Date('2026-07-01T14:00:00Z'),
        );

        expect(row).toMatchObject({
            flag: 'missing_clock_out',
            incomplete_attendance_id: 7,
            late_minutes: 20,
            early_leave_minutes: null,
            // the flag hides it, but the arrival was still late
            is_late: true,
            left_early: false,
        });
    });

    it('marks a shift both late and left early, though its flag says only late', () => {
        const [row] = compareScheduleWithAttendance([shift()], [punch('2026-07-01T06:12:00Z', '2026-07-01T13:40:00Z')]);

        expect(row).toMatchObject({ flag: 'late', is_late: true, left_early: true });
    });

    it('flags a clock-out with no clock-in as missing_clock_in, with no arrival to judge', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:00:00Z', '2026-07-01T14:00:00Z', { attendance_id: 7, clock_in: null })],
        );

        expect(row).toMatchObject({
            flag: 'missing_clock_in',
            incomplete_attendance_id: 7,
            actual_clock_in: null,
            late_minutes: null,
            early_leave_minutes: 0,
        });
        expect(row.actual_clock_out).toEqual(new Date('2026-07-01T14:00:00Z'));
    });

    it('still knows the arrival when only the punch after lunch is missing its clock-in', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [
                punch('2026-07-01T06:10:00Z', '2026-07-01T09:00:00Z'),
                punch('2026-07-01T06:00:00Z', '2026-07-01T14:00:00Z', { attendance_id: 9, clock_in: null }),
            ],
        );

        expect(row).toMatchObject({ flag: 'missing_clock_in', incomplete_attendance_id: 9, late_minutes: 10 });
        expect(row.actual_clock_in).toEqual(new Date('2026-07-01T06:10:00Z'));
    });
});

describe('compareScheduleWithAttendance - clock-out with no clock-in', () => {
    const outOnly = (clockOut: string) => punch('2026-07-01T00:00:00Z', clockOut, { clock_in: null });

    it('matches only a clock-out between the shift start and the late-departure window', () => {
        const endAt = scheduledInstant('2026-07-01', '17:00').getTime();
        const justInside = new Date(endAt + LATE_DEPARTURE_WINDOW_MINUTES * 60 * 1000).toISOString();
        const justOutside = new Date(endAt + (LATE_DEPARTURE_WINDOW_MINUTES + 1) * 60 * 1000).toISOString();

        expect(compareScheduleWithAttendance([shift()], [outOnly(justInside)])[0].flag).toBe('missing_clock_in');
        expect(compareScheduleWithAttendance([shift()], [outOnly(justOutside)])[0].flag).toBe('no_show');
        // at the start itself nobody has worked any of the shift yet
        expect(compareScheduleWithAttendance([shift()], [outOnly('2026-07-01T06:00:00Z')])[0].flag).toBe('no_show');
    });
});

describe('compareScheduleWithAttendance - matching', () => {
    it('ignores a punch from another branch', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:00:00Z', '2026-07-01T14:00:00Z', { branch_id: 2 })],
        );

        expect(row.flag).toBe('no_show');
    });

    it('ignores a punch from another worker', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T06:00:00Z', '2026-07-01T14:00:00Z', { user_id: 2 })],
        );

        expect(row.flag).toBe('no_show');
    });

    it('ignores a punch clocked in after the shift had already ended', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-07-01T14:30:00Z', '2026-07-01T18:00:00Z')],
        );

        expect(row.flag).toBe('no_show');
    });

    it('ignores a punch that ended before the shift began', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-06-30T20:00:00Z', '2026-07-01T06:00:00Z')],
        );

        expect(row.flag).toBe('no_show');
    });

    it('spans a lunch break: first clock-in, last clock-out', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [
                punch('2026-07-01T06:00:00Z', '2026-07-01T09:00:00Z'),
                punch('2026-07-01T10:00:00Z', '2026-07-01T14:00:00Z'),
            ],
        );

        expect(row.flag).toBe('on_time');
        expect(row.actual_clock_in).toEqual(new Date('2026-07-01T06:00:00Z'));
        expect(row.actual_clock_out).toEqual(new Date('2026-07-01T14:00:00Z'));
    });

    it('reports no clock-out when the last punch of the shift is still open', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [
                punch('2026-07-01T06:00:00Z', '2026-07-01T09:00:00Z'),
                punch('2026-07-01T10:00:00Z', null),
            ],
        );

        expect(row.actual_clock_out).toBeNull();
        expect(row.early_leave_minutes).toBeNull();
    });

    // A forgotten clock-out must not read as presence-until-further-notice, or one open punch would
    // mark every shift after it attended.
    it('does not let a punch left open days ago cover a later shift', () => {
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [punch('2026-06-28T06:00:00Z', null)],
        );

        expect(row.flag).toBe('no_show');
    });

    it('counts an open punch only inside the early-arrival window', () => {
        const startAt = scheduledInstant('2026-07-01', '09:00').getTime();
        const justInside = new Date(startAt - EARLY_ARRIVAL_WINDOW_MINUTES * 60 * 1000);
        const justOutside = new Date(justInside.getTime() - 60 * 1000);

        expect(
            compareScheduleWithAttendance([shift()], [punch(justInside.toISOString(), null)], MID_SHIFT)[0].flag,
        ).toBe('on_time');
        expect(
            compareScheduleWithAttendance([shift()], [punch(justOutside.toISOString(), null)], MID_SHIFT)[0].flag,
        ).toBe('no_show');
    });

    it('matches each of a worker\'s two branches to its own punch', () => {
        const rows = compareScheduleWithAttendance(
            [
                shift({ branch_id: 1, start_time: '09:00', end_time: '13:00' }),
                shift({ branch_id: 2, start_time: '15:00', end_time: '19:00' }),
            ],
            [
                punch('2026-07-01T06:00:00Z', '2026-07-01T10:00:00Z', { branch_id: 1 }),
                punch('2026-07-01T12:40:00Z', '2026-07-01T16:00:00Z', { branch_id: 2 }),
            ],
        );

        expect(rows.map((row) => row.flag)).toEqual(['on_time', 'late']);
        expect(rows[1].late_minutes).toBe(40);
    });

    it('returns rows in chronological order whatever order the shifts arrive in', () => {
        const rows = compareScheduleWithAttendance(
            [
                shift({ shift_date: '2026-07-03' }),
                shift({ shift_date: '2026-07-01' }),
                shift({ shift_date: '2026-07-02' }),
            ],
            [],
        );

        expect(rows.map((row) => row.shift_date)).toEqual([
            '2026-07-01',
            '2026-07-02',
            '2026-07-03',
        ]);
    });
});

/**
 * Two shift rows, 09:00-17:00 and 17:00-21:00, worked on a single punch. An earlier design consumed
 * each punch so no two shifts could claim it, which reported the evening shift as a no_show for a
 * man who never left the building. One presence interval covering two shifts is the ordinary case,
 * not a conflict — these five rows are what tells the two designs apart.
 */
describe('compareScheduleWithAttendance - a split day on one punch', () => {
    const splitDay = (clockIn: string, clockOut: string | null) =>
        compareScheduleWithAttendance([morning(), evening()], [punch(clockIn, clockOut)]);

    it('credits both shifts when the whole day was worked', () => {
        const [first, second] = splitDay('2026-07-01T05:55:00Z', '2026-07-01T18:03:00Z');

        expect(first.flag).toBe('on_time');
        expect(second.flag).toBe('on_time');
        expect(second.actual_clock_in).toEqual(new Date('2026-07-01T05:55:00Z'));
        expect(second.actual_clock_out).toEqual(new Date('2026-07-01T18:03:00Z'));
    });

    it('reports the evening as cut short when the worker went home just after it began', () => {
        const [first, second] = splitDay('2026-07-01T05:55:00Z', '2026-07-01T14:05:00Z');

        expect(first.flag).toBe('on_time');
        expect(second.flag).toBe('left_early');
        expect(second.early_leave_minutes).toBe(235);
    });

    it('reports a no_show when the worker left exactly as the evening shift began', () => {
        const [first, second] = splitDay('2026-07-01T05:55:00Z', '2026-07-01T14:00:00Z');

        expect(first.flag).toBe('on_time');
        expect(second.flag).toBe('no_show');
    });

    it('reports a no_show for the evening when the worker went home at noon', () => {
        const [first, second] = splitDay('2026-07-01T05:55:00Z', '2026-07-01T09:00:00Z');

        expect(first.flag).toBe('left_early');
        expect(second.flag).toBe('no_show');
    });

    it('reports both as no_shows when nothing was punched', () => {
        const rows = compareScheduleWithAttendance([morning(), evening()], []);

        expect(rows.map((row) => row.flag)).toEqual(['no_show', 'no_show']);
    });

    it('counts an overnight pair, which the schema stores as two rows on two dates', () => {
        const rows = compareScheduleWithAttendance(
            [
                shift({ shift_date: '2026-07-01', start_time: '21:00', end_time: '23:59' }),
                shift({ shift_date: '2026-07-02', start_time: '00:00', end_time: '05:00' }),
            ],
            [punch('2026-07-01T17:58:00Z', '2026-07-02T02:03:00Z')],
        );

        expect(rows.map((row) => row.flag)).toEqual(['on_time', 'on_time']);
    });
});

describe('compareScheduleWithAttendance - one owner per lone clock-out', () => {
    it('gives a lone clock-out to the shift it falls inside, not the one before it too', () => {
        // 17:00-21:00 evening right after a fully punched 09:00-17:00 morning; 18:00 clock-out only
        const rows = compareScheduleWithAttendance(
            [morning(), evening()],
            [
                punch('2026-07-01T06:00:00Z', '2026-07-01T14:00:00Z'),
                punch('2026-07-01T00:00:00Z', '2026-07-01T15:00:00Z', { attendance_id: 9, clock_in: null }),
            ],
        );

        expect(rows.map((row) => row.flag)).toEqual(['on_time', 'missing_clock_in']);
        expect(rows[0].incomplete_attendance_id).toBeNull();
        expect(rows[1].incomplete_attendance_id).toBe(9);
    });

    it('gives a lone clock-out between two shifts to the one it could have left late from', () => {
        // 09:00-12:00 and 12:30-17:00; a clock-out at 12:20 is after the first ended and before the
        // second began, so only the first could own it
        const first = shift({ start_time: '09:00', end_time: '12:00' });
        const second = shift({ start_time: '12:30', end_time: '17:00' });
        const rows = compareScheduleWithAttendance(
            [first, second],
            [punch('2026-07-01T00:00:00Z', '2026-07-01T09:20:00Z', { clock_in: null })],
        );

        expect(rows.map((row) => row.flag)).toEqual(['missing_clock_in', 'no_show']);
    });

    it('does not report a later clock-in as the arrival when the first punch is missing its clock-in', () => {
        // missed clock-in before lunch (out at 12:00), then a full punch 13:00-17:00
        const [row] = compareScheduleWithAttendance(
            [shift()],
            [
                punch('2026-07-01T00:00:00Z', '2026-07-01T09:00:00Z', { clock_in: null }),
                punch('2026-07-01T10:00:00Z', '2026-07-01T14:00:00Z'),
            ],
        );

        expect(row).toMatchObject({ flag: 'missing_clock_in', actual_clock_in: null, late_minutes: null });
    });
});
