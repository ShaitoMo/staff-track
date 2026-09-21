import { ScheduledShiftRoleRow } from '@/repository/coverage-repository'
import { CoverageGapRow } from '@/types/coverage-gap'
import { toDateOnlyString } from '@/types/date-only'

export interface CoverageRequirementSummary {
    roleId: number
    periodId: number
    requiredCount: number
}

/**
 * requiredCount vs scheduledCount per (shiftDate, role, period), for every date in `weekDates`.
 *
 * Every requirement applies to every date now that CoverageRequirement carries no weekday: this is
 * a plain cross-join of `requirements` against `weekDates`, not a resolved override — each
 * requirement produces exactly one row per date.
 */
export function resolveCoverageGaps(
    weekDates: string[],
    requirements: CoverageRequirementSummary[],
    scheduled: ScheduledShiftRoleRow[],
): CoverageGapRow[] {
    const scheduledCounts = countScheduled(scheduled)

    const rows: CoverageGapRow[] = []

    for (const shiftDate of weekDates) {
        for (const requirement of requirements) {
            rows.push({
                shiftDate,
                roleId: requirement.roleId,
                periodId: requirement.periodId,
                requiredCount: requirement.requiredCount,
                scheduledCount:
                    scheduledCounts.get(key(shiftDate, requirement.periodId, requirement.roleId)) ?? 0,
            })
        }
    }

    return rows
}

/**
 * Distinct workers per (date, period, role), not shift rows — the same person scheduled twice in
 * one slot (a data-entry mistake, or a split shift) is one person covering it, not two.
 */
function countScheduled(scheduled: ScheduledShiftRoleRow[]): Map<string, number> {
    const workersByKey = new Map<string, Set<number>>()

    for (const shift of scheduled) {
        const shiftKey = key(toDateOnlyString(shift.shiftDate), shift.periodId, shift.roleId)
        const workers = workersByKey.get(shiftKey) ?? new Set<number>()
        workers.add(shift.userId)
        workersByKey.set(shiftKey, workers)
    }

    const counts = new Map<string, number>()

    for (const [shiftKey, workers] of workersByKey) {
        counts.set(shiftKey, workers.size)
    }

    return counts
}

function key(shiftDate: string, periodId: number, roleId: number): string {
    return `${shiftDate}:${periodId}:${roleId}`
}
