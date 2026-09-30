import { CoverageRequirementRepository } from '@/repository/coverage-requirement-repository'
import { ShiftPeriodRepository } from '@/repository/shift-period-repository'
import { BranchRepository } from '@/repository/branch-repository'
import { RoleRepository } from '@/repository/role-repository'
import {
    CoverageRequirementView,
    CreateCoverageRequirementInput,
    UpdateCoverageRequirementInput,
} from '@/types/coverage-requirement'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'

/**
 * A helper for schedule building only: these rows express "how many of this role should be on this
 * period, every day" for the roles × periods grid. Nothing here creates, blocks, or modifies a
 * shift — see CoverageRequirement's own schema comment.
 */
export class CoverageRequirementService {
    static async getRequirementsByBranch(branchId: number): Promise<CoverageRequirementView[]> {
        await BranchRepository.assertExists(branchId)
        return CoverageRequirementRepository.getRequirementsByBranch(branchId)
    }

    static async createRequirement(data: CreateCoverageRequirementInput): Promise<CoverageRequirementView> {
        await BranchRepository.assertExists(data.branchId)
        await CoverageRequirementService.assertRoleExists(data.roleId)
        await ShiftPeriodRepository.assertAtBranch(data.periodId, data.branchId)

        return CoverageRequirementRepository.createRequirement(data)
    }

    /** Minimal read — used by route guards to resolve a requirement's branch before an edit. */
    static async getRequirementById(requirementId: number): Promise<{ branchId: number } | null> {
        return CoverageRequirementRepository.getRequirementById(requirementId)
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

    private static async assertRoleExists(roleId: number): Promise<void> {
        const role = await RoleRepository.getRoleById(roleId)

        if (!role) {
            throw new RoleNotFoundError()
        }
    }
}
