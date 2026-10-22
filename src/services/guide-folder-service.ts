import { GuideFolderRecord, GuideFolderRepository } from '@/repository/guide-folder-repository'
import {
    BranchSectionView,
    CreateGuideFolderInput,
    DeactivationImpact,
    GuideFolderView,
    ReactivationImpact,
    UpdateGuideFolderInput,
} from '@/types/shelf-guide'
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error'
import { InactiveGuideParentError } from '@/exceptions/inactive-guide-parent-error'

/**
 * Invariant kept here: an active folder always sits in an active section under an active parent.
 * Creating or reactivating under something inactive is refused, so hiding things from staff never
 * needs to walk up the tree.
 */
export class GuideFolderService {
    /** `visibleOnly` for staff: an inactive parent is reported missing. `includeInactive` lists inactive children (editors only). */
    static async getFolders(
        section: BranchSectionView,
        parentFolderId: number | null,
        options: { includeInactive: boolean; visibleOnly: boolean },
    ): Promise<GuideFolderView[]> {
        if (parentFolderId !== null) {
            await GuideFolderRepository.getFolderInSection(section.branchSectionId, parentFolderId, options.visibleOnly)
        }

        return GuideFolderRepository.getChildren(section.branchSectionId, parentFolderId, options.includeInactive)
    }

    static async getFolder(folderId: number): Promise<GuideFolderRecord> {
        const folder = await GuideFolderRepository.getFolderById(folderId)

        if (!folder) {
            throw new GuideFolderNotFoundError()
        }

        return folder
    }

    static async createFolder(section: BranchSectionView, data: CreateGuideFolderInput): Promise<GuideFolderView> {
        const parentFolderId = data.parentFolderId ?? null

        if (!section.isActive) {
            throw new InactiveGuideParentError()
        }

        if (parentFolderId !== null) {
            const parent = await GuideFolderRepository.getFolderInSection(section.branchSectionId, parentFolderId)

            if (!parent.view.isActive) {
                throw new InactiveGuideParentError()
            }
        }

        return GuideFolderRepository.createFolder({ branchSectionId: section.branchSectionId, parentFolderId, name: data.name })
    }

    static async updateFolder(folderId: number, data: UpdateGuideFolderInput): Promise<GuideFolderView> {
        return GuideFolderRepository.updateFolder(folderId, data)
    }

    static async deactivateFolder(folderId: number): Promise<void> {
        await GuideFolderRepository.deactivateFolder(folderId, new Date())
    }

    static async reactivateFolder(folder: GuideFolderRecord): Promise<ReactivationImpact> {
        if (!folder.sectionActive || !folder.parentActive) {
            throw new InactiveGuideParentError()
        }

        return GuideFolderRepository.reactivateFolder(folder.view.folderId, new Date())
    }

    static async getDeactivationImpact(folderId: number): Promise<DeactivationImpact> {
        return GuideFolderRepository.deactivationImpact(folderId)
    }

    static async getReactivationImpact(folderId: number): Promise<ReactivationImpact> {
        return GuideFolderRepository.reactivationImpact(folderId)
    }
}
