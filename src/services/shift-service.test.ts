jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/shift-repository', () => ({
    ShiftRepository: { getOverlappingShifts: jest.fn() },
}));

import { ShiftService } from '@/services/shift-service';
import { ShiftRepository, OverlapQuery } from '@/repository/shift-repository';
import { ShiftView } from '@/types/shift';
import { ShiftOverlapError } from '@/exceptions/shift-overlap-error';

const getOverlappingShifts = ShiftRepository.getOverlappingShifts as jest.MockedFunction<
    typeof ShiftRepository.getOverlappingShifts
>;

/** `assertNoDoubleBooking` is private; element access reaches it without widening the service API. */
const assertNoDoubleBooking = (query: OverlapQuery): Promise<void> =>
    ShiftService['assertNoDoubleBooking'](query);

/** `mergeSpan` is private; element access reaches it without widening the service API. */
const mergeSpan = (
    before: ShiftView,
    data: Parameters<typeof ShiftService['mergeSpan']>[1],
): { shiftDate: Date; startTime: Date; endTime: Date } => ShiftService['mergeSpan'](before, data);

const QUERY: OverlapQuery = {
    userId: 7,
    shiftDate: new Date('2026-08-13T00:00:00Z'),
    startTime: new Date('1970-01-01T09:00:00Z'),
    endTime: new Date('1970-01-01T17:00:00Z'),
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('assertNoDoubleBooking', () => {
    it('passes when the repository finds no clash', async () => {
        getOverlappingShifts.mockResolvedValue([]);

        await expect(assertNoDoubleBooking(QUERY)).resolves.toBeUndefined();
    });

    it('refuses when the repository finds a clashing shift', async () => {
        getOverlappingShifts.mockResolvedValue([{ shift_id: 1 } as ShiftView]);

        await expect(assertNoDoubleBooking(QUERY)).rejects.toThrow(ShiftOverlapError);
    });

    it('passes the query straight through to the repository', async () => {
        getOverlappingShifts.mockResolvedValue([]);

        await assertNoDoubleBooking(QUERY);

        expect(getOverlappingShifts).toHaveBeenCalledWith(QUERY);
    });
});

describe('mergeSpan — the span re-checked on an edit', () => {
    const stored: ShiftView = {
        shift_id: 1,
        user_id: 7,
        branch_id: 1,
        register_id: null,
        period_id: null,
        shift_date: '2026-08-13',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 3,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
    };

    it('uses the stored span untouched when the patch mentions none of it', () => {
        const span = mergeSpan(stored, {});

        expect(span.shiftDate.toISOString()).toBe('2026-08-13T00:00:00.000Z');
        expect(span.startTime.toISOString().slice(11, 16)).toBe('09:00');
        expect(span.endTime.toISOString().slice(11, 16)).toBe('17:00');
    });

    it('takes the new time over the stored one when the patch moves it', () => {
        const newStart = new Date('1970-01-01T12:00:00Z');
        const newEnd = new Date('1970-01-01T20:00:00Z');

        const span = mergeSpan(stored, { start_time: newStart, end_time: newEnd });

        expect(span.startTime).toBe(newStart);
        expect(span.endTime).toBe(newEnd);
    });
});
