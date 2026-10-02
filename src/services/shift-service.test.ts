jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/shift-repository', () => ({
    ShiftRepository: {
        getOverlappingShifts: jest.fn(),
        getShifts: jest.fn(),
        getShiftsForUsers: jest.fn(),
        createShifts: jest.fn(),
    },
}));
jest.mock('@/repository/branch-repository', () => ({
    BranchRepository: { assertExists: jest.fn() },
}));
jest.mock('@/repository/user-repository', () => ({
    UserRepository: { getAllUsers: jest.fn() },
}));

import { ShiftService } from '@/services/shift-service';
import { ShiftRepository, OverlapQuery } from '@/repository/shift-repository';
import { UserRepository } from '@/repository/user-repository';
import { ShiftView } from '@/types/shift';
import { SafeUser } from '@/types/user';
import { ShiftOverlapError } from '@/exceptions/shift-overlap-error';

const getOverlappingShifts = ShiftRepository.getOverlappingShifts as jest.MockedFunction<
    typeof ShiftRepository.getOverlappingShifts
>;
const getShifts = ShiftRepository.getShifts as jest.MockedFunction<typeof ShiftRepository.getShifts>;
const getShiftsForUsers = ShiftRepository.getShiftsForUsers as jest.MockedFunction<
    typeof ShiftRepository.getShiftsForUsers
>;
const createShifts = ShiftRepository.createShifts as jest.MockedFunction<typeof ShiftRepository.createShifts>;
const getAllUsers = UserRepository.getAllUsers as jest.MockedFunction<typeof UserRepository.getAllUsers>;

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

describe('copyWeek', () => {
    const shift = (overrides: Partial<ShiftView>): ShiftView => ({
        shift_id: 1,
        user_id: 7,
        branch_id: 1,
        register_id: 2,
        period_id: 3,
        shift_date: '2026-09-21',
        start_time: '09:00',
        end_time: '17:00',
        created_by: 3,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    });
    const staff = (userId: number, isActive = true) => ({ userId, isActive }) as SafeUser;
    const copy = () => ShiftService.copyWeek({
        branch_id: 1,
        week_start: new Date('2026-09-28T00:00:00Z'),
        created_by: 9,
    });

    beforeEach(() => {
        createShifts.mockImplementation(async (rows) => rows.length);
    });

    it('reads the seven days before week_start and copies each shift seven days forward', async () => {
        getShifts.mockResolvedValue([shift({})]);
        getAllUsers.mockResolvedValue([staff(7)]);
        getShiftsForUsers.mockResolvedValue([]);

        await expect(copy()).resolves.toEqual({ created: 1, skipped: 0 });

        expect(getShifts).toHaveBeenCalledWith({
            branchId: 1,
            from: new Date('2026-09-21T00:00:00Z'),
            to: new Date('2026-09-27T00:00:00Z'),
        });
        const [row] = createShifts.mock.calls[0][0];
        expect(row).toMatchObject({ userId: 7, registerId: 2, periodId: 3, createdBy: 9 });
        expect((row.shiftDate as Date).toISOString()).toBe('2026-09-28T00:00:00.000Z');
    });

    it('skips a shift that clashes with one already booked in the target week', async () => {
        getShifts.mockResolvedValue([shift({}), shift({ shift_id: 2, shift_date: '2026-09-22' })]);
        getAllUsers.mockResolvedValue([staff(7)]);
        getShiftsForUsers.mockResolvedValue([shift({ shift_id: 5, shift_date: '2026-09-28', start_time: '16:00', end_time: '20:00' })]);

        await expect(copy()).resolves.toEqual({ created: 1, skipped: 1 });
    });

    it('treats a handover (one ends as the next starts) as no clash', async () => {
        getShifts.mockResolvedValue([shift({})]);
        getAllUsers.mockResolvedValue([staff(7)]);
        getShiftsForUsers.mockResolvedValue([shift({ shift_id: 5, shift_date: '2026-09-28', start_time: '17:00', end_time: '21:00' })]);

        await expect(copy()).resolves.toEqual({ created: 1, skipped: 0 });
    });

    it('skips people who are inactive or no longer at the branch, without querying their bookings', async () => {
        getShifts.mockResolvedValue([shift({ user_id: 7 }), shift({ shift_id: 2, user_id: 8 })]);
        getAllUsers.mockResolvedValue([staff(7, false)]);

        await expect(copy()).resolves.toEqual({ created: 0, skipped: 2 });
        expect(getShiftsForUsers).not.toHaveBeenCalled();
    });
});
