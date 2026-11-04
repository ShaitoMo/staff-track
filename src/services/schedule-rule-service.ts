import { BranchRepository } from '@/repository/branch-repository'
import { ScheduleRuleRepository } from '@/repository/schedule-rule-repository'
import { ShiftPeriodRepository } from '@/repository/shift-period-repository'
import { UserRepository } from '@/repository/user-repository'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error'
import { SaveScheduleRulesInput, ScheduleRules } from '@/types/schedule-builder'

/**
 * A branch's scheduling rules: pairs Auto-fill keeps apart and the only periods a person may get.
 * Only Auto-fill reads them; see ScheduleBuilderService.propose.
 */
export class ScheduleRuleService {
    static async getRules(branchId: number): Promise<ScheduleRules> {
        await BranchRepository.assertExists(branchId)

        return ScheduleRuleRepository.getRules(branchId)
    }

    /**
     * Replaces the branch's rule set with `data`. Everyone named must be linked to the branch and
     * every period on and offered there. The set is tidied before saving: (X, Y) and (Y, X) are one
     * pair, a person listed twice gets their periods merged, and an empty limit is dropped.
     */
    static async replaceRules(data: SaveScheduleRulesInput): Promise<ScheduleRules> {
        await BranchRepository.assertExists(data.branchId)

        const [users, periods] = await Promise.all([
            UserRepository.getAllUsers([data.branchId]),
            ShiftPeriodRepository.getPeriodsByBranch(data.branchId),
        ])
        const userIds = new Set(users.map((user) => user.userId))
        const periodIds = new Set(periods.map((period) => period.periodId))

        const named = [...data.keepApart.flat(), ...data.periodLimits.map((limit) => limit.userId)]
        if (named.some((userId) => !userIds.has(userId))) {
            throw new UserNotAtBranchError('A rule names someone who does not work at this branch')
        }
        if (data.periodLimits.some((limit) => limit.periodIds.some((periodId) => !periodIds.has(periodId)))) {
            throw new ShiftPeriodNotAtBranchError('A rule names a period that is not offered at this branch')
        }

        await ScheduleRuleRepository.replaceRules(data.branchId, ScheduleRuleService.tidy(data))

        return ScheduleRuleRepository.getRules(data.branchId)
    }

    private static tidy(rules: ScheduleRules): ScheduleRules {
        const pairs = new Map<string, [number, number]>()
        for (const [x, y] of rules.keepApart) {
            const pair: [number, number] = x < y ? [x, y] : [y, x]
            pairs.set(pair.join(':'), pair)
        }

        const periodsByUser = new Map<number, Set<number>>()
        for (const { userId, periodIds } of rules.periodLimits) {
            periodsByUser.set(userId, new Set([...(periodsByUser.get(userId) ?? []), ...periodIds]))
        }

        return {
            keepApart: [...pairs.values()],
            periodLimits: [...periodsByUser]
                .filter(([, periodIds]) => periodIds.size > 0)
                .map(([userId, periodIds]) => ({ userId, periodIds: [...periodIds] })),
        }
    }
}
