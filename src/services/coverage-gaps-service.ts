import { CoverageRequirementRepository } from '@/repository/coverage-requirement-repository'
import { CoverageRepository } from '@/repository/coverage-repository'
import { BranchRepository } from '@/repository/branch-repository'
import { CoverageGapRow } from '@/types/coverage-gap'
import { resolveCoverageGaps } from '@/lib/coverage-gaps'
import { toDateOnlyString } from '@/types/date-only'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_PER_WEEK = 7

export class CoverageGapsService {
    /** requiredCount vs scheduledCount for one branch's week, one row per (shiftDate, role, period). */
    static async getCoverageGaps(branchId: number, weekStart: Date): Promise<CoverageGapRow[]> {
        await CoverageGapsService.assertBranchExists(branchId)

        const weekEnd = new Date(weekStart.getTime() + (DAYS_PER_WEEK - 1) * MS_PER_DAY)

        const [requirements, scheduled] = await Promise.all([
            CoverageRequirementRepository.getRequirementsByBranch(branchId),
            CoverageRepository.getScheduledShiftsByBranch(branchId, weekStart, weekEnd),
        ])

        return resolveCoverageGaps(
            CoverageGapsService.datesOf(weekStart),
            requirements.map((requirement) => ({
                roleId: requirement.role.roleId,
                periodId: requirement.period.periodId,
                requiredCount: requirement.requiredCount,
            })),
            scheduled,
        )
    }

    private static datesOf(weekStart: Date): string[] {
        return Array.from({ length: DAYS_PER_WEEK }, (_, offset) =>
            toDateOnlyString(new Date(weekStart.getTime() + offset * MS_PER_DAY)),
        )
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }
    }
}
