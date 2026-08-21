import { ShiftPeriodRepository, ShiftPeriodRecord } from '@/repository/shift-period-repository'
import { BranchRepository } from '@/repository/branch-repository'
import { CreatePeriodInput, ShiftPeriodView, UpdatePeriodInput } from '@/types/shift-period'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'

export class PeriodService {
    /** Periods available to a branch: its own, plus every chain-wide one. */
    static async getPeriodsByBranch(branchId: number): Promise<ShiftPeriodView[]> {
        await PeriodService.assertBranchExists(branchId)
        return ShiftPeriodRepository.getPeriodsByBranch(branchId)
    }

    /** Minimal read — used by route guards to resolve a period's branch (null = chain-wide) before an edit. */
    static async getPeriodById(periodId: number): Promise<ShiftPeriodRecord | null> {
        return ShiftPeriodRepository.getPeriodById(periodId)
    }

    static async createPeriod(data: CreatePeriodInput): Promise<ShiftPeriodView> {
        if (data.branchId !== null && data.branchId !== undefined) {
            await PeriodService.assertBranchExists(data.branchId)
        }

        return ShiftPeriodRepository.createPeriod(data)
    }

    static async updatePeriod(periodId: number, data: UpdatePeriodInput): Promise<ShiftPeriodView> {
        return ShiftPeriodRepository.updatePeriod(periodId, data)
    }

    /** Never cascades: refused with a 409 while any shift or coverage requirement still references it. */
    static async deletePeriod(periodId: number): Promise<void> {
        return ShiftPeriodRepository.deletePeriod(periodId)
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }
    }
}
