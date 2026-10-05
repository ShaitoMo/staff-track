jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/shift-repository', () => ({
    ShiftRepository: { getShifts: jest.fn() },
}));

import { AttendanceService } from '@/services/attendance-service';
import { ImportedPunch } from '@/repository/attendance-repository';
import { ShiftRepository } from '@/repository/shift-repository';
import { ShiftView } from '@/types/shift';

const getShifts = ShiftRepository.getShifts as jest.MockedFunction<typeof ShiftRepository.getShifts>;

type LonePunch = ImportedPunch & { clockOutNextDay?: Date };

/** `placeLoneClockOuts` is private; element access reaches it without widening the service API. */
const placeLoneClockOuts = (punches: LonePunch[]): Promise<ImportedPunch[]> =>
    AttendanceService['placeLoneClockOuts'](1, punches);

const EPOCH = new Date('1970-01-01T00:00:00.000Z');

/** Fixtures sit in early October 2026, when Beirut is +03:00. */
function evening(shiftDate: string, userId = 1): ShiftView {
    return {
        shift_id: 1,
        user_id: userId,
        branch_id: 1,
        register_id: null,
        period_id: null,
        shift_date: shiftDate,
        start_time: '16:00',
        end_time: '23:00',
        created_by: 99,
        created_at: EPOCH,
        updated_at: EPOCH,
    };
}

/** A clock-out with no clock-in, read off the row for 1 Oct, with its next-morning reading. */
function lone(rowDay: string, nextDay: string, userId = 1): LonePunch {
    return { userId, branchId: 1, clockIn: null, clockOut: new Date(rowDay), clockOutNextDay: new Date(nextDay) };
}

beforeEach(() => {
    getShifts.mockReset();
});

describe('AttendanceService.placeLoneClockOuts', () => {
    it('moves a lone after-midnight clock-out to the next morning when only that ends a shift', async () => {
        // 00:30 Beirut: on the row's own date it is before the 16:00 shift; the next morning it is
        // 90 minutes after that shift's 23:00 end
        getShifts.mockResolvedValue([evening('2026-10-01')]);

        const [placed] = await placeLoneClockOuts([lone('2026-09-30T21:30:00Z', '2026-10-01T21:30:00Z')]);

        expect(placed.clockOut).toEqual(new Date('2026-10-01T21:30:00Z'));
    });

    it('keeps the row date when that already ends a shift', async () => {
        // 23:00 Beirut on 1 Oct ends the evening shift as read
        getShifts.mockResolvedValue([evening('2026-10-01')]);

        const [placed] = await placeLoneClockOuts([lone('2026-10-01T20:00:00Z', '2026-10-02T20:00:00Z')]);

        expect(placed.clockOut).toEqual(new Date('2026-10-01T20:00:00Z'));
    });

    it('keeps the row date when neither reading ends a shift of that person', async () => {
        getShifts.mockResolvedValue([evening('2026-10-01', 2)]);

        const [placed] = await placeLoneClockOuts([lone('2026-09-30T21:30:00Z', '2026-10-01T21:30:00Z')]);

        expect(placed.clockOut).toEqual(new Date('2026-09-30T21:30:00Z'));
    });

    it('reads no shifts when the file has no lone clock-outs', async () => {
        const complete: LonePunch = {
            userId: 1,
            branchId: 1,
            clockIn: new Date('2026-10-01T13:00:00Z'),
            clockOut: new Date('2026-10-01T20:00:00Z'),
        };

        expect(await placeLoneClockOuts([complete])).toEqual([complete]);
        expect(getShifts).not.toHaveBeenCalled();
    });
});
