jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/shift-repository', () => ({
    ShiftRepository: { getShifts: jest.fn(), copyIntoWeek: jest.fn() },
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
jest.mock('@/services/coverage-gaps-service', () => ({
    CoverageGapsService: { getCoverageGaps: jest.fn() },
}));
jest.mock('@/repository/schedule-rule-repository', () => ({
    ScheduleRuleRepository: { getRules: jest.fn() },
}));
jest.mock('@/lib/scheduler-client', () => ({ solveSchedule: jest.fn() }));

import { ScheduleBuilderService } from '@/services/schedule-builder-service';
import { NewShiftRow, ShiftRepository } from '@/repository/shift-repository';
import { ScheduleRuleRepository } from '@/repository/schedule-rule-repository';
import { ShiftPeriodRepository } from '@/repository/shift-period-repository';
import { UserRepository } from '@/repository/user-repository';
import { CoverageGapsService } from '@/services/coverage-gaps-service';
import { solveSchedule } from '@/lib/scheduler-client';
import { SchedulerUnavailableError } from '@/exceptions/scheduler-unavailable-error';
import { CoverageGapRow } from '@/types/coverage-gap';
import { ShiftView } from '@/types/shift';
import { ShiftPeriodView } from '@/types/shift-period';
import { SafeUser } from '@/types/user';

const getShifts = ShiftRepository.getShifts as jest.MockedFunction<typeof ShiftRepository.getShifts>;
const copyIntoWeek = ShiftRepository.copyIntoWeek as jest.MockedFunction<typeof ShiftRepository.copyIntoWeek>;
const getAllUsers = UserRepository.getAllUsers as jest.MockedFunction<typeof UserRepository.getAllUsers>;
const getPeriodsByBranch = ShiftPeriodRepository.getPeriodsByBranch as jest.MockedFunction<
    typeof ShiftPeriodRepository.getPeriodsByBranch
>;
const getCoverageGaps = CoverageGapsService.getCoverageGaps as jest.MockedFunction<
    typeof CoverageGapsService.getCoverageGaps
>;
const solve = solveSchedule as jest.MockedFunction<typeof solveSchedule>;
const getRules = ScheduleRuleRepository.getRules as jest.MockedFunction<typeof ScheduleRuleRepository.getRules>;
const NO_RULES = { keepApart: [], periodLimits: [] };

const CASHIER = 3;
const STOCKER = 4;
const weekStart = new Date('2026-11-02T00:00:00.000Z');
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const user = (userId: number, roleId = CASHIER, isActive = true) =>
    ({ userId, name: `User ${userId}`, roleId, isActive }) as SafeUser;
const gap = (shiftDate: string, requiredCount: number, scheduledCount: number, roleId = CASHIER, periodId = 1): CoverageGapRow =>
    ({ shiftDate, roleId, periodId, requiredCount, scheduledCount });
const shift = (user_id: number, shift_date: string, period_id: number | null = null) =>
    ({ user_id, shift_date, branch_id: 9, period_id }) as ShiftView;
const morning = { periodId: 1, defaultStart: '08:00', defaultEnd: '16:00' } as ShiftPeriodView;

beforeEach(() => jest.resetAllMocks());

describe('ScheduleBuilderService.propose', () => {
    const input = { branchId: 1, weekStart, maxShiftsPerWeek: 5 };

    beforeEach(() => getRules.mockResolvedValue(NO_RULES));

    it('sends only what is still short, the active people in those roles, and their week at every branch', async () => {
        getCoverageGaps.mockResolvedValue([
            gap('2026-11-02', 2, 1), // one more cashier needed
            gap('2026-11-03', 1, 1), // covered
            gap('2026-11-03', 0, 0, STOCKER), // explicitly not needed
        ]);
        getAllUsers.mockResolvedValue([user(10), user(11, CASHIER, false), user(12, STOCKER)]);
        getShifts.mockResolvedValue([shift(10, '2026-11-04'), shift(10, '2026-11-04')]);
        solve.mockResolvedValue({ assignments: [{ slotId: 0, userId: 10 }], unfilled: [] });

        const proposal = await ScheduleBuilderService.propose(input);

        expect(getShifts).toHaveBeenCalledWith({ userIds: [10], from: weekStart, to: day('2026-11-08') });
        expect(getShifts).toHaveBeenCalledTimes(1);
        expect(solve).toHaveBeenCalledWith({
            maxShiftsPerWeek: 5,
            slots: [{ slotId: 0, date: '2026-11-02', periodId: 1, roleId: CASHIER, needed: 1 }],
            employees: [{ userId: 10, roleId: CASHIER, existingShifts: 2, blockedSlotIds: [] }],
            keepApart: [],
        });
        expect(proposal.assignments).toEqual([{ userId: 10, roleId: CASHIER, periodId: 1, shiftDate: '2026-11-02' }]);
        expect(proposal.employees).toEqual([{
            userId: 10,
            name: 'User 10',
            roleId: CASHIER,
            busyDates: ['2026-11-04'],
            existingShifts: 2,
            allowedPeriodIds: null,
            keepApartWith: [],
            partnerShifts: [],
        }]);
        expect(copyIntoWeek).not.toHaveBeenCalled();
    });

    it("blocks the slots outside someone's periods", async () => {
        getCoverageGaps.mockResolvedValue([gap('2026-11-02', 1, 0, CASHIER, 1), gap('2026-11-02', 1, 0, CASHIER, 2)]);
        getAllUsers.mockResolvedValue([user(10)]);
        getRules.mockResolvedValue({ keepApart: [], periodLimits: [{ userId: 10, periodIds: [2] }] });
        getShifts.mockResolvedValue([]);
        solve.mockResolvedValue({ assignments: [], unfilled: [] });

        await ScheduleBuilderService.propose(input);

        expect(solve.mock.calls[0][0].employees[0].blockedSlotIds).toEqual([0]);
    });

    it("keeps pairs apart: both up for the week go to the solver, a partner's shift here blocks that day and period", async () => {
        getCoverageGaps.mockResolvedValue([gap('2026-11-02', 2, 0, CASHIER, 1), gap('2026-11-03', 1, 0, CASHIER, 1)]);
        getAllUsers.mockResolvedValue([user(10), user(11), user(20, STOCKER)]);
        // 10 & 11 both cashiers; 10 & 20, where 20 isn't up for the week but already works Monday morning here
        getRules.mockResolvedValue({ keepApart: [[10, 11], [10, 20]], periodLimits: [] });
        getShifts
            .mockResolvedValueOnce([]) // the staff's week, every branch
            .mockResolvedValueOnce([shift(20, '2026-11-02', 1)]); // partners' shifts at this branch
        solve.mockResolvedValue({ assignments: [], unfilled: [] });

        const proposal = await ScheduleBuilderService.propose(input);

        // everyone with a partner up for the week, 20 included though not up themselves
        expect(getShifts).toHaveBeenLastCalledWith({ branchId: 1, userIds: [10, 11, 20], from: weekStart, to: day('2026-11-08') });
        const sent = solve.mock.calls[0][0];
        expect(sent.keepApart).toEqual([[10, 11]]);
        expect(sent.employees.map((e) => [e.userId, e.blockedSlotIds])).toEqual([[10, [0]], [11, []]]);
        expect(proposal.employees.find((e) => e.userId === 10)?.partnerShifts).toEqual([{ shiftDate: '2026-11-02', periodId: 1 }]);
    });

    it('drops solver rows naming a slot or person it was never sent', async () => {
        getCoverageGaps.mockResolvedValue([gap('2026-11-02', 1, 0)]);
        getAllUsers.mockResolvedValue([user(10)]);
        getShifts.mockResolvedValue([]);
        solve.mockResolvedValue({
            assignments: [{ slotId: 0, userId: 99 }, { slotId: 7, userId: 10 }],
            unfilled: [{ slotId: 0, missing: 1 }, { slotId: 7, missing: 1 }],
        });

        const proposal = await ScheduleBuilderService.propose(input);

        expect(proposal.assignments).toEqual([]);
        expect(proposal.unfilled).toEqual([{ shiftDate: '2026-11-02', periodId: 1, roleId: CASHIER, missing: 1 }]);
    });

    it('skips the solver when nobody can fill the open slots, reporting them all unfilled', async () => {
        getCoverageGaps.mockResolvedValue([gap('2026-11-02', 2, 0, STOCKER)]);
        getAllUsers.mockResolvedValue([user(10, CASHIER)]);

        const proposal = await ScheduleBuilderService.propose(input);

        expect(solve).not.toHaveBeenCalled();
        expect(proposal.unfilled).toEqual([{ shiftDate: '2026-11-02', periodId: 1, roleId: STOCKER, missing: 2 }]);
    });

    it('skips the solver when the week is already covered', async () => {
        getCoverageGaps.mockResolvedValue([gap('2026-11-02', 1, 1)]);
        getAllUsers.mockResolvedValue([user(10)]);

        const proposal = await ScheduleBuilderService.propose(input);

        expect(solve).not.toHaveBeenCalled();
        expect(proposal).toEqual({ maxShiftsPerWeek: 5, assignments: [], unfilled: [], employees: [] });
    });

    it('lets a solver outage through for the route to answer 503', async () => {
        getCoverageGaps.mockResolvedValue([gap('2026-11-02', 1, 0)]);
        getAllUsers.mockResolvedValue([user(10)]);
        getShifts.mockResolvedValue([]);
        solve.mockRejectedValue(new SchedulerUnavailableError());

        await expect(ScheduleBuilderService.propose(input)).rejects.toThrow(SchedulerUnavailableError);
    });
});

describe('ScheduleBuilderService.approve', () => {
    const row = (userId: number, shiftDate: string, roleId = CASHIER, periodId = 1) =>
        ({ userId, roleId, periodId, shiftDate: day(shiftDate) });

    /** Runs the plan against `booked` the way the repository would, and reports what it inserted. */
    function insertAgainst(booked: ShiftView[]): { inserted: () => NewShiftRow[] } {
        let rows: NewShiftRow[] = [];
        copyIntoWeek.mockImplementation(async (_window, plan) => {
            rows = plan(booked);
            return rows.length;
        });
        return { inserted: () => rows };
    }

    beforeEach(() => {
        getAllUsers.mockResolvedValue([user(10), user(11), user(12, STOCKER), user(13, CASHIER, false)]);
        getPeriodsByBranch.mockResolvedValue([morning]);
        getRules.mockResolvedValue(NO_RULES);
    });

    it("inserts in the period's current hours, no register, under copy-week's lock window", async () => {
        const { inserted } = insertAgainst([]);

        const result = await ScheduleBuilderService.approve({
            branchId: 1, weekStart, maxShiftsPerWeek: 6, createdBy: 2, shifts: [row(10, '2026-11-02')],
        });

        expect(result).toEqual({ created: 1, skipped: 0 });
        expect(copyIntoWeek.mock.calls[0][0]).toEqual({
            branchId: 1, from: weekStart, to: day('2026-11-08'), userIds: [10], registerIds: [],
        });
        expect(inserted()).toEqual([{
            userId: 10,
            branchId: 1,
            registerId: null,
            periodId: 1,
            shiftDate: day('2026-11-02'),
            startTime: new Date('1970-01-01T08:00:00.000Z'),
            endTime: new Date('1970-01-01T16:00:00.000Z'),
            createdBy: 2,
        }]);
    });

    it("skips rows that no longer hold: role changed, inactive or not at the branch, period not offered, outside the week", async () => {
        const { inserted } = insertAgainst([]);

        const result = await ScheduleBuilderService.approve({
            branchId: 1,
            weekStart,
            maxShiftsPerWeek: 6,
            createdBy: 2,
            shifts: [
                row(10, '2026-11-02'),
                row(12, '2026-11-02', CASHIER), // a stocker on a cashier slot
                row(13, '2026-11-02'), // inactive
                row(99, '2026-11-02'), // not linked to the branch
                row(11, '2026-11-02', CASHIER, 5), // period not offered here
                row(11, '2026-11-09'), // the week after
            ],
        });

        expect(result).toEqual({ created: 1, skipped: 5 });
        expect(inserted().map((r) => r.userId)).toEqual([10]);
    });

    it('skips a day the person is already booked (at any branch) and a second row for the same day', async () => {
        const { inserted } = insertAgainst([shift(11, '2026-11-02')]);

        const result = await ScheduleBuilderService.approve({
            branchId: 1,
            weekStart,
            maxShiftsPerWeek: 6,
            createdBy: 2,
            shifts: [row(11, '2026-11-02'), row(10, '2026-11-03'), row(10, '2026-11-03')],
        });

        expect(result).toEqual({ created: 1, skipped: 2 });
        expect(inserted().map((r) => [r.userId, r.shiftDate])).toEqual([[10, day('2026-11-03')]]);
    });

    it('skips rows a scheduling rule or the weekly cap rules out, judged against what is booked by then', async () => {
        const evening = { periodId: 2, defaultStart: '16:00', defaultEnd: '23:00' } as ShiftPeriodView;
        const here = (booked: ShiftView) => ({ ...booked, branch_id: 1 });
        getPeriodsByBranch.mockResolvedValue([morning, evening]);
        // 10 may only work evenings; 11 and 20 are kept apart, and 20 already works Tuesday morning here
        getRules.mockResolvedValue({ keepApart: [[11, 20]], periodLimits: [{ userId: 10, periodIds: [2] }] });
        const { inserted } = insertAgainst([here(shift(20, '2026-11-03', 1)), here(shift(11, '2026-11-05', 1))]);

        const result = await ScheduleBuilderService.approve({
            branchId: 1,
            weekStart,
            maxShiftsPerWeek: 2,
            createdBy: 2,
            shifts: [
                row(10, '2026-11-02', CASHIER, 1), // morning, outside 10's periods
                row(10, '2026-11-03', CASHIER, 2), // evening: fine
                row(11, '2026-11-03', CASHIER, 1), // partner 20 is already there
                row(11, '2026-11-04', CASHIER, 1), // fine: 1 booked + this = 2
                row(11, '2026-11-06', CASHIER, 1), // past the cap of 2
            ],
        });

        // the partner's shifts come back inside the lock too
        expect(copyIntoWeek.mock.calls[0][0].userIds).toEqual([10, 11, 20]);
        expect(result).toEqual({ created: 2, skipped: 3 });
        expect(inserted().map((r) => [r.userId, r.shiftDate, r.periodId])).toEqual([
            [10, day('2026-11-03'), 2],
            [11, day('2026-11-04'), 1],
        ]);
    });

    it('keeps apart two people who are both on the approved list for the same day and period', async () => {
        getRules.mockResolvedValue({ keepApart: [[10, 11]], periodLimits: [] });
        const { inserted } = insertAgainst([]);

        const result = await ScheduleBuilderService.approve({
            branchId: 1,
            weekStart,
            maxShiftsPerWeek: 6,
            createdBy: 2,
            shifts: [row(10, '2026-11-02'), row(11, '2026-11-02'), row(11, '2026-11-03')],
        });

        expect(result).toEqual({ created: 2, skipped: 1 });
        expect(inserted().map((r) => [r.userId, r.shiftDate])).toEqual([[10, day('2026-11-02')], [11, day('2026-11-03')]]);
    });

    it('never opens the transaction when nothing is valid', async () => {
        const result = await ScheduleBuilderService.approve({
            branchId: 1, weekStart, maxShiftsPerWeek: 6, createdBy: 2, shifts: [row(99, '2026-11-02')],
        });

        expect(result).toEqual({ created: 0, skipped: 1 });
        expect(copyIntoWeek).not.toHaveBeenCalled();
    });
});
