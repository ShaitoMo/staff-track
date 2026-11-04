import { db } from '@/lib/db'
import { ScheduleRules } from '@/types/schedule-builder'

/**
 * The rules that apply today: people still linked to the branch, and periods still on. The rest
 * stay stored but out of sight, and come back if the person is linked again or the period turned
 * back on. Reads and replaces use the same filters, so a save only ever rewrites what it was shown.
 */
const linkedTo = (branchId: number) => ({ branchLinks: { some: { branchId } } })
const visiblePairs = (branchId: number) => ({ branchId, userA: linkedTo(branchId), userB: linkedTo(branchId) })
const visibleLimits = (branchId: number) => ({ branchId, user: linkedTo(branchId), period: { active: true } })

export class ScheduleRuleRepository {
    /** A branch's rules that apply today, pairs and each person's periods in id order. */
    static async getRules(branchId: number): Promise<ScheduleRules> {
        const [pairs, limits] = await Promise.all([
            db.scheduleKeepApart.findMany({
                where: visiblePairs(branchId),
                orderBy: [{ userAId: 'asc' }, { userBId: 'asc' }],
            }),
            db.schedulePeriodLimit.findMany({
                where: visibleLimits(branchId),
                orderBy: [{ userId: 'asc' }, { periodId: 'asc' }],
            }),
        ])

        const periodsByUser = new Map<number, number[]>()

        for (const { userId, periodId } of limits) {
            periodsByUser.set(userId, [...(periodsByUser.get(userId) ?? []), periodId])
        }

        return {
            keepApart: pairs.map(({ userAId, userBId }) => [userAId, userBId]),
            periodLimits: [...periodsByUser].map(([userId, periodIds]) => ({ userId, periodIds })),
        }
    }

    /**
     * Swaps the branch's visible rules for `rules` in one transaction; hidden ones are left as they
     * are. Expects `rules` already clean and visible (the service checks people and periods): pairs
     * low id first with no repeats, one entry per person, no empty limits.
     */
    static async replaceRules(branchId: number, rules: ScheduleRules): Promise<void> {
        await db.$transaction([
            db.scheduleKeepApart.deleteMany({ where: visiblePairs(branchId) }),
            db.schedulePeriodLimit.deleteMany({ where: visibleLimits(branchId) }),
            db.scheduleKeepApart.createMany({
                data: rules.keepApart.map(([userAId, userBId]) => ({ branchId, userAId, userBId })),
            }),
            db.schedulePeriodLimit.createMany({
                data: rules.periodLimits.flatMap(({ userId, periodIds }) =>
                    periodIds.map((periodId) => ({ branchId, userId, periodId }))),
            }),
        ])
    }
}
