jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/shift-repository', () => ({
    ShiftRepository: {
        getOverlappingShifts: jest.fn(),
        getShifts: jest.fn(),
        copyIntoWeek: jest.fn(),
    },
}));
jest.mock('@/repository/branch-repository', () => ({
    BranchRepository: { assertExists: jest.fn() },
}));
jest.mock('@/repository/user-repository', () => ({
    UserRepository: { getAllUsers: jest.fn() },
}));
jest.mock('@/repository/shift-period-repository', () => ({
    ShiftPeriodRepository: { getPeriodsByBranch: jest.fn() },
}));

import { ShiftService } from '@/services/shift-service';
import { NewShiftRow, ShiftRepository, OverlapQuery, RegisterOverlapQuery } from '@/repository/shift-repository';
import { ShiftPeriodRepository } from '@/repository/shift-period-repository';
import { UserRepository } from '@/repository/user-repository';
import { ShiftView } from '@/types/shift';
import { ShiftPeriodView } from '@/types/shift-period';
import { SafeUser } from '@/types/user';
import { ShiftOverlapError } from '@/exceptions/shift-overlap-error';
import { RegisterOverlapError } from '@/exceptions/register-overlap-error';

const getOverlappingShifts = ShiftRepository.getOverlappingShifts as jest.MockedFunction<
    typeof ShiftRepository.getOverlappingShifts
>;
const getShifts = ShiftRepository.getShifts as jest.MockedFunction<typeof ShiftRepository.getShifts>;
const copyIntoWeek = ShiftRepository.copyIntoWeek as jest.MockedFunction<typeof ShiftRepository.copyIntoWeek>;
const getAllUsers = UserRepository.getAllUsers as jest.MockedFunction<typeof UserRepository.getAllUsers>;
const getPeriodsByBranch = ShiftPeriodRepository.getPeriodsByBranch as jest.MockedFunction<
    typeof ShiftPeriodRepository.getPeriodsByBranch
>;

/** `assertNoDoubleBooking` is private; element access reaches it without widening the service API. */
const assertNoDoubleBooking = (query: OverlapQuery): Promise<void> =>
    ShiftService['assertNoDoubleBooking'](query);

/** `assertRegisterFree` is private; element access reaches it without widening the service API. */
const assertRegisterFree = (
    registerId: number | null | undefined,
    span: Omit<RegisterOverlapQuery, 'registerId'>,
): Promise<void> => ShiftService['assertRegisterFree'](registerId, span);

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

describe('assertRegisterFree', () => {
    const SPAN = { shiftDate: QUERY.shiftDate, startTime: QUERY.startTime, endTime: QUERY.endTime };

    it('refuses when another shift holds the register at an overlapping time', async () => {
        getOverlappingShifts.mockResolvedValue([{ shift_id: 1 } as ShiftView]);

        await expect(assertRegisterFree(4, SPAN)).rejects.toThrow(RegisterOverlapError);
        expect(getOverlappingShifts).toHaveBeenCalledWith({ registerId: 4, ...SPAN });
    });

    it('passes when the register is free', async () => {
        getOverlappingShifts.mockResolvedValue([]);

        await expect(assertRegisterFree(4, SPAN)).resolves.toBeUndefined();
    });

    it('skips the lookup for a shift with no register', async () => {
        await expect(assertRegisterFree(null, SPAN)).resolves.toBeUndefined();
        await expect(assertRegisterFree(undefined, SPAN)).resolves.toBeUndefined();
        expect(getOverlappingShifts).not.toHaveBeenCalled();
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

    const period = (periodId: number, defaultStart: string, defaultEnd: string) =>
        ({ periodId, branchId: 1, name: 'Morning', defaultStart, defaultEnd, sortOrder: 1 }) as ShiftPeriodView;

    /** Stands in for the transaction: hands `plan` what is already booked and records what it would insert. */
    function bookedInTarget(booked: ShiftView[]): () => NewShiftRow[] {
        let inserted: NewShiftRow[] = [];
        copyIntoWeek.mockImplementation(async (_window, plan) => {
            inserted = plan(booked);
            return inserted.length;
        });
        return () => inserted;
    }

    const timeOf = (value: NewShiftRow['startTime']) => (value as Date).toISOString().slice(11, 16);

    beforeEach(() => {
        getPeriodsByBranch.mockResolvedValue([period(3, '09:00', '17:00')]);
    });

    it('reads the seven days before week_start and copies each shift seven days forward', async () => {
        getShifts.mockResolvedValue([shift({})]);
        getAllUsers.mockResolvedValue([staff(7)]);
        const inserted = bookedInTarget([]);

        await expect(copy()).resolves.toEqual({ created: 1, skipped: 0 });

        expect(getShifts).toHaveBeenCalledWith({
            branchId: 1,
            from: new Date('2026-09-21T00:00:00Z'),
            to: new Date('2026-09-27T00:00:00Z'),
        });
        expect(copyIntoWeek.mock.calls[0][0]).toEqual({
            branchId: 1,
            from: new Date('2026-09-28T00:00:00Z'),
            to: new Date('2026-10-04T00:00:00Z'),
            userIds: [7],
            registerIds: [2],
        });
        const [row] = inserted();
        expect(row).toMatchObject({ userId: 7, registerId: 2, periodId: 3, createdBy: 9 });
        expect((row.shiftDate as Date).toISOString()).toBe('2026-09-28T00:00:00.000Z');
    });

    it("gives a period shift the period's current hours, and keeps a custom-hours shift's own", async () => {
        getPeriodsByBranch.mockResolvedValue([period(3, '07:00', '15:00')]);
        getShifts.mockResolvedValue([shift({}), shift({ shift_id: 2, period_id: null, start_time: '18:00', end_time: '20:00' })]);
        getAllUsers.mockResolvedValue([staff(7)]);
        const inserted = bookedInTarget([]);

        await copy();

        expect(inserted().map((row) => `${timeOf(row.startTime)}-${timeOf(row.endTime)}`)).toEqual(['07:00-15:00', '18:00-20:00']);
    });

    it('skips a shift that clashes with one already booked in the target week', async () => {
        getShifts.mockResolvedValue([shift({}), shift({ shift_id: 2, shift_date: '2026-09-22' })]);
        getAllUsers.mockResolvedValue([staff(7)]);
        bookedInTarget([shift({ shift_id: 5, shift_date: '2026-09-28', start_time: '16:00', end_time: '20:00' })]);

        await expect(copy()).resolves.toEqual({ created: 1, skipped: 1 });
    });

    it('skips a shift whose register someone else already holds at that time in the target week', async () => {
        getShifts.mockResolvedValue([shift({})]);
        getAllUsers.mockResolvedValue([staff(7)]);
        bookedInTarget([shift({ shift_id: 5, user_id: 8, shift_date: '2026-09-28', start_time: '12:00', end_time: '20:00' })]);

        await expect(copy()).resolves.toEqual({ created: 0, skipped: 1 });
    });

    it('copies only the first of two last-week shifts that would now share a register', async () => {
        // a period shift moves to the period's current hours, so it can land on top of a custom-hours one
        getPeriodsByBranch.mockResolvedValue([period(3, '12:00', '20:00')]);
        getShifts.mockResolvedValue([
            shift({ start_time: '09:00', end_time: '17:00', period_id: null }),
            shift({ shift_id: 2, user_id: 8 }),
        ]);
        getAllUsers.mockResolvedValue([staff(7), staff(8)]);
        const inserted = bookedInTarget([]);

        await expect(copy()).resolves.toEqual({ created: 1, skipped: 1 });
        expect(inserted().map((row) => row.userId)).toEqual([7]);
    });

    it('lets two shifts without a register overlap, as long as the people differ', async () => {
        getShifts.mockResolvedValue([shift({ register_id: null }), shift({ shift_id: 2, user_id: 8, register_id: null })]);
        getAllUsers.mockResolvedValue([staff(7), staff(8)]);
        bookedInTarget([]);

        await expect(copy()).resolves.toEqual({ created: 2, skipped: 0 });
    });

    it('treats a handover (one ends as the next starts) as no clash', async () => {
        getShifts.mockResolvedValue([shift({})]);
        getAllUsers.mockResolvedValue([staff(7)]);
        bookedInTarget([shift({ shift_id: 5, shift_date: '2026-09-28', start_time: '17:00', end_time: '21:00' })]);

        await expect(copy()).resolves.toEqual({ created: 1, skipped: 0 });
    });

    it('skips people who are inactive or no longer at the branch, without opening the copy transaction', async () => {
        getShifts.mockResolvedValue([shift({ user_id: 7 }), shift({ shift_id: 2, user_id: 8 })]);
        getAllUsers.mockResolvedValue([staff(7, false)]);

        await expect(copy()).resolves.toEqual({ created: 0, skipped: 2 });
        expect(copyIntoWeek).not.toHaveBeenCalled();
    });
});
