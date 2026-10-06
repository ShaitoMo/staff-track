import { buildAttendanceRows, fixTimeToIso, formatMachineTime, formatMinutes, missedMinutes, punchToIso, summarizeStatuses } from '@/lib/attendance-rows';
import { ScheduleVsActualRow } from '@/types/schedule-vs-actual';

function row(overrides: Partial<ScheduleVsActualRow>): ScheduleVsActualRow {
    return {
        shift_id: 1,
        user_id: 1,
        branch_id: 1,
        shift_date: '2026-01-12',
        scheduled_start: '09:00',
        scheduled_end: '17:00',
        actual_clock_in: null,
        actual_clock_out: null,
        flag: 'no_show',
        incomplete_attendance_id: null,
        late_minutes: null,
        early_leave_minutes: null,
        is_late: false,
        left_early: false,
        ...overrides,
    };
}

describe('punchToIso', () => {
    it('reads the times as Beirut wall-clock (winter, +02:00)', () => {
        expect(punchToIso('2026-01-12', '09:00', '17:30')).toEqual({
            clock_in: '2026-01-12T07:00:00.000Z',
            clock_out: '2026-01-12T15:30:00.000Z',
        });
    });

    it('follows the summer offset (+03:00)', () => {
        expect(punchToIso('2026-07-01', '09:00').clock_in).toBe('2026-07-01T06:00:00.000Z');
    });

    it('leaves the clock-out null when none is given', () => {
        expect(punchToIso('2026-01-12', '09:00').clock_out).toBeNull();
    });

    it('rolls a clock-out at or before the clock-in to the next morning', () => {
        expect(punchToIso('2026-01-12', '15:00', '01:00').clock_out).toBe('2026-01-12T23:00:00.000Z');
        expect(punchToIso('2026-01-12', '09:00', '09:00').clock_out).toBe('2026-01-13T07:00:00.000Z');
    });
});

describe('formatMachineTime', () => {
    it('shows the instant on the Beirut clock, from a Date or a JSON string', () => {
        expect(formatMachineTime(new Date('2026-01-12T07:05:00.000Z'))).toBe('09:05');
        expect(formatMachineTime('2026-01-12T22:00:00.000Z')).toBe('00:00');
    });
});

describe('summarizeStatuses', () => {
    it('counts every status, zero included, plus slips the flag hides', () => {
        expect(
            summarizeStatuses([
                { status: 'late', isLate: true, leftEarly: false },
                { status: 'late', isLate: true, leftEarly: true },
                { status: 'upcoming', isLate: false, leftEarly: false },
                { status: 'missing_clock_out', isLate: true, leftEarly: false },
            ]),
        ).toEqual({
            on_time: 0,
            late: 3,
            left_early: 1,
            missing_clock_in: 0,
            missing_clock_out: 1,
            no_show: 0,
            upcoming: 1,
        });
    });
});

describe('buildAttendanceRows', () => {
    const users = [
        { userId: 1, name: 'Rana' },
        { userId: 2, name: 'Ali' },
    ];

    it('orders by day, then start, then name, and joins names', () => {
        const rows = buildAttendanceRows(
            [
                row({ shift_id: 1, user_id: 1, shift_date: '2026-01-13' }),
                row({ shift_id: 2, user_id: 1, scheduled_start: '14:00', scheduled_end: '22:00' }),
                row({ shift_id: 3, user_id: 1 }),
                row({ shift_id: 4, user_id: 2 }),
            ],
            users,
        );

        expect(rows.map((r) => r.shiftId)).toEqual([4, 3, 2, 1]);
        expect(rows[0]).toMatchObject({ name: 'Ali', scheduled: '09:00–17:00' });
    });

    it('trims seconds off scheduled times and falls back to the id for an unknown person', () => {
        const [only] = buildAttendanceRows([row({ user_id: 9, scheduled_start: '09:00:00', scheduled_end: '17:00:00' })], users);

        expect(only).toMatchObject({ name: 'User 9', scheduled: '09:00–17:00', clockIn: null, clockOut: null });
    });

    it('describes only the slips past the grace period', () => {
        const [late, both, withinGrace] = buildAttendanceRows(
            [
                row({ shift_id: 1, scheduled_start: '08:00', flag: 'late', late_minutes: 12, early_leave_minutes: -3, is_late: true }),
                row({ shift_id: 2, scheduled_start: '09:00', flag: 'late', late_minutes: 7, early_leave_minutes: 20, is_late: true, left_early: true }),
                row({ shift_id: 3, scheduled_start: '10:00', flag: 'on_time', late_minutes: 4, early_leave_minutes: null }),
            ],
            users,
        );

        expect(late.detail).toBe('12 min late');
        expect(both.detail).toBe('7 min late · left 20 min early');
        expect(withinGrace.detail).toBeNull();
        expect([late.leftEarly, both.leftEarly, withinGrace.leftEarly]).toEqual([false, true, false]);
    });
});

describe('buildAttendanceRows status', () => {
    // Mon 12 Jan 2026, 10:00 in Beirut (+02:00)
    const now = new Date('2026-01-12T08:00:00.000Z');

    it('calls a punchless shift that has not started yet upcoming, not a no-show', () => {
        const [started, ahead] = buildAttendanceRows(
            [
                row({ shift_id: 1, scheduled_start: '09:00' }),
                row({ shift_id: 2, scheduled_start: '11:00' }),
            ],
            [],
            now,
        );

        expect(started.status).toBe('no_show');
        expect(ahead.status).toBe('upcoming');
    });

    it('keeps the reported flag once punches exist', () => {
        const [only] = buildAttendanceRows(
            [row({ shift_date: '2026-01-13', flag: 'on_time', actual_clock_in: new Date('2026-01-13T07:00:00.000Z') })],
            [],
            now,
        );

        expect(only.status).toBe('on_time');
    });
});

describe('fixTimeToIso', () => {
    it('puts a missing clock-in on the shift date, in Beirut time', () => {
        expect(fixTimeToIso('2026-01-12', '16:00', '16:20', 'clock_in')).toBe('2026-01-12T14:20:00.000Z');
    });

    it('rolls a clock-out before the scheduled start to the next morning, not one exactly at it', () => {
        expect(fixTimeToIso('2026-01-12', '16:00', '23:00', 'clock_out')).toBe('2026-01-12T21:00:00.000Z');
        expect(fixTimeToIso('2026-01-12', '16:00', '01:15', 'clock_out')).toBe('2026-01-12T23:15:00.000Z');
        expect(fixTimeToIso('2026-01-12', '16:00', '15:59', 'clock_out')).toBe('2026-01-13T13:59:00.000Z');
        expect(fixTimeToIso('2026-01-12', '16:00:00', '16:00', 'clock_out')).toBe('2026-01-12T14:00:00.000Z');
    });

    it('never rolls a clock-in', () => {
        expect(fixTimeToIso('2026-01-12', '16:00', '07:00', 'clock_in')).toBe('2026-01-12T05:00:00.000Z');
    });
});

describe('buildAttendanceRows fix', () => {
    it('offers the missing end of the incomplete punch, and nothing on a complete row', () => {
        const [missingIn, missingOut, complete] = buildAttendanceRows(
            [
                row({ shift_id: 1, scheduled_start: '08:00', flag: 'missing_clock_in', incomplete_attendance_id: 4 }),
                row({ shift_id: 2, scheduled_start: '09:00', flag: 'missing_clock_out', incomplete_attendance_id: 5 }),
                row({ shift_id: 3, scheduled_start: '10:00', flag: 'on_time' }),
            ],
            [],
        );

        expect(missingIn.fix).toEqual({ attendanceId: 4, end: 'clock_in' });
        expect(missingOut.fix).toEqual({ attendanceId: 5, end: 'clock_out' });
        expect(complete.fix).toBeNull();
    });
});

describe('missedMinutes', () => {
    it('sums late and early slips past the grace period, skipping no-shows, missing punches and slips within it', () => {
        expect(
            missedMinutes([
                row({ flag: 'late', late_minutes: 45, early_leave_minutes: 0, is_late: true }),
                row({ flag: 'late', late_minutes: 12, early_leave_minutes: 20, is_late: true, left_early: true }),
                row({ flag: 'on_time', late_minutes: 3, early_leave_minutes: -10 }),
                row({ flag: 'no_show' }),
                // late, but its clock-out is still missing, so not counted yet
                row({ flag: 'missing_clock_out', late_minutes: 30, is_late: true, incomplete_attendance_id: 7 }),
            ]),
        ).toBe(77);
    });
});

describe('formatMinutes', () => {
    it('shows hours once there is an hour or more', () => {
        expect(formatMinutes(0)).toBe('0 min');
        expect(formatMinutes(45)).toBe('45 min');
        expect(formatMinutes(60)).toBe('1 h');
        expect(formatMinutes(77)).toBe('1 h 17 min');
    });
});
