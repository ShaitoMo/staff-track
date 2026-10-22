import { BranchRepository } from '@/repository/branch-repository'
import { BranchSectionRepository } from '@/repository/branch-section-repository'
import { SectionTypeRepository } from '@/repository/section-type-repository'
import {
    BranchSectionView,
    CreateBranchSectionInput,
    DeactivationImpact,
    ReactivationImpact,
    UpdateBranchSectionInput,
} from '@/types/shelf-guide'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'
import { SectionTypeNotFoundError } from '@/exceptions/section-type-not-found-error'

export class BranchSectionService {
    static async getSectionsByBranch(branchId: number, includeInactive: boolean): Promise<BranchSectionView[]> {
        await BranchRepository.assertExists(branchId)
        return BranchSectionRepository.getSectionsByBranch(branchId, includeInactive)
    }

    static async getSection(branchSectionId: number): Promise<BranchSectionView> {
        const section = await BranchSectionRepository.getSectionById(branchSectionId)

        if (!section) {
            throw new BranchSectionNotFoundError()
        }

        return section
    }

    /** An inactive section type can still be added: deactivating a type only takes it off the owner's active list. */
    static async createSection(branchId: number, data: CreateBranchSectionInput): Promise<BranchSectionView> {
        await BranchRepository.assertExists(branchId)

        if (!await SectionTypeRepository.getSectionTypeById(data.sectionTypeId)) {
            throw new SectionTypeNotFoundError()
        }

        return BranchSectionRepository.createSection({ branchId, ...data })
    }

    static async updateSection(branchSectionId: number, data: UpdateBranchSectionInput): Promise<BranchSectionView> {
        return BranchSectionRepository.updateSection(branchSectionId, data)
    }

    static async deactivateSection(branchSectionId: number): Promise<void> {
        await BranchSectionRepository.deactivateSection(branchSectionId, new Date())
    }

    static async reactivateSection(branchSectionId: number): Promise<ReactivationImpact> {
        return BranchSectionRepository.reactivateSection(branchSectionId, new Date())
    }

    static async getDeactivationImpact(branchSectionId: number): Promise<DeactivationImpact> {
        return BranchSectionRepository.deactivationImpact(branchSectionId)
    }

    static async getReactivationImpact(branchSectionId: number): Promise<ReactivationImpact> {
        return BranchSectionRepository.reactivationImpact(branchSectionId)
    }
}
