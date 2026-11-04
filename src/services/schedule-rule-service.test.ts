jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/schedule-rule-repository', () => ({
    ScheduleRuleRepository: { getRules: jest.fn(), replaceRules: jest.fn() },
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

import { ScheduleRuleService } from '@/services/schedule-rule-service';
import { ScheduleRuleRepository } from '@/repository/schedule-rule-repository';
import { UserRepository } from '@/repository/user-repository';
import { ShiftPeriodRepository } from '@/repository/shift-period-repository';
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error';
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error';
import { ShiftPeriodView } from '@/types/shift-period';
import { SafeUser } from '@/types/user';

const replaceRules = ScheduleRuleRepository.replaceRules as jest.MockedFunction<typeof ScheduleRuleRepository.replaceRules>;
const getAllUsers = UserRepository.getAllUsers as jest.MockedFunction<typeof UserRepository.getAllUsers>;
const getPeriodsByBranch = ShiftPeriodRepository.getPeriodsByBranch as jest.MockedFunction<
    typeof ShiftPeriodRepository.getPeriodsByBranch
>;

beforeEach(() => {
    jest.resetAllMocks();
    getAllUsers.mockResolvedValue([10, 11, 12].map((userId) => ({ userId }) as SafeUser));
    // the branch's periods that are on: 1 and 2
    getPeriodsByBranch.mockResolvedValue([1, 2].map((periodId) => ({ periodId }) as ShiftPeriodView));
});

describe('ScheduleRuleService.replaceRules', () => {
    it('saves a tidy set: one pair however it was written, merged periods, no empty limits', async () => {
        await ScheduleRuleService.replaceRules({
            branchId: 1,
            keepApart: [[11, 10], [10, 11], [10, 12]],
            periodLimits: [{ userId: 10, periodIds: [1] }, { userId: 10, periodIds: [2, 1] }, { userId: 11, periodIds: [] }],
        });

        expect(replaceRules).toHaveBeenCalledWith(1, {
            keepApart: [[10, 11], [10, 12]],
            periodLimits: [{ userId: 10, periodIds: [1, 2] }],
        });
    });

    it('refuses someone not linked to the branch, in a pair or a limit', async () => {
        await expect(ScheduleRuleService.replaceRules({ branchId: 1, keepApart: [[10, 99]], periodLimits: [] }))
            .rejects.toThrow(UserNotAtBranchError);
        await expect(ScheduleRuleService.replaceRules({ branchId: 1, keepApart: [], periodLimits: [{ userId: 99, periodIds: [1] }] }))
            .rejects.toThrow(UserNotAtBranchError);
        expect(replaceRules).not.toHaveBeenCalled();
    });

    it('refuses a period that is off or not offered at the branch', async () => {
        await expect(ScheduleRuleService.replaceRules({ branchId: 1, keepApart: [], periodLimits: [{ userId: 10, periodIds: [3] }] }))
            .rejects.toThrow(ShiftPeriodNotAtBranchError);
        expect(replaceRules).not.toHaveBeenCalled();
    });
});
