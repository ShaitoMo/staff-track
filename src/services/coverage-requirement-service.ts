import { CoverageRequirementRepository } from '@/repository/coverage-requirement-repository'
import { ShiftPeriodRepository, ShiftPeriodRecord } from '@/repository/shift-period-repository'
import { BranchRepository } from '@/repository/branch-repository'
import { RolesRepository } from '@/repository/role-repository'
import {
    CoverageRequirementView,
    CreateCoverageRequirementInput,
    UpdateCoverageRequirementInput,
} from '@/types/coverage-requirement'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error'

/**
 * A helper for schedule building only: these rows express "how many of this role should be on this
 * period, every day" for the roles × periods grid. Nothing here creates, blocks, or modifies a
 * shift — see CoverageRequirement's own schema comment.
 */
export class CoverageRequirementService {
    static async getRequirementsByBranch(branchId: number): Promise<CoverageRequirementView[]> {
        await CoverageRequirementService.assertBranchExists(branchId)
        return CoverageRequirementRepository.getRequirementsByBranch(branchId)
    }

    static async createRequirement(data: CreateCoverageRequirementInput): Promise<CoverageRequirementView> {
        await CoverageRequirementService.assertBranchExists(data.branchId)
        await CoverageRequirementService.assertRoleExists(data.roleId)
        await CoverageRequirementService.assertPeriodAtBranch(data.periodId, data.branchId)

        return CoverageRequirementRepository.createRequirement(data)
    }

    static async updateRequirement(
        requirementId: number,
        data: UpdateCoverageRequirementInput,
    ): Promise<CoverageRequirementView> {
        return CoverageRequirementRepository.updateRequirement(requirementId, data)
    }

    static async deleteRequirement(requirementId: number): Promise<void> {
        return CoverageRequirementRepository.deleteRequirement(requirementId)
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }
    }

    private static async assertRoleExists(roleId: number): Promise<void> {
        const role = await RolesRepository.getRoleById(roleId)

        if (!role) {
            throw new RoleNotFoundError()
        }
    }

    /** A NULL branchId on the period is the chain-wide default and matches every branch. */
    private static async assertPeriodAtBranch(periodId: number, branchId: number): Promise<ShiftPeriodRecord> {
        const period = await ShiftPeriodRepository.getPeriodById(periodId)

        if (!period) {
            throw new ShiftPeriodNotFoundError()
        }

        if (period.branchId !== null && period.branchId !== branchId) {
            throw new ShiftPeriodNotAtBranchError()
        }

        return period
    }
}
