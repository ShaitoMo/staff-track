import { GuideFolderRepository } from '@/repository/guide-folder-repository'
import { GuideImageRecord, GuideImageRepository } from '@/repository/guide-image-repository'
import { createGuideUploadUrls, deletePhoto, verifyGuideUpload } from '@/lib/storage'
import {
    BranchSectionView,
    CreateGuideImageInput,
    GuideUploadView,
    UpdateGuideImageInput,
} from '@/types/shelf-guide'
import { GuideImageNotFoundError } from '@/exceptions/guide-image-not-found-error'
import { GuidePhotoKeyInUseError } from '@/exceptions/guide-photo-key-in-use-error'
import { InactiveGuideParentError } from '@/exceptions/inactive-guide-parent-error'

/**
 * Upload is two steps, like task proof: photo-upload hands out signed PUT URLs for the photo and
 * its thumbnail (both JPEGs the browser made), then create/replace confirms the keys. Storage
 * calls stay outside the database transaction.
 */
export class GuideImageService {
    static async createUpload(section: BranchSectionView): Promise<GuideUploadView> {
        if (!section.isActive) {
            throw new InactiveGuideParentError()
        }

        return createGuideUploadUrls(section.branchSectionId)
    }

    /** `visibleOnly` for staff: an inactive folder is reported missing, not listed as empty. */
    static async getImages(section: BranchSectionView, folderId: number | null, visibleOnly: boolean): Promise<GuideImageRecord[]> {
        if (folderId !== null) {
            await GuideFolderRepository.getFolderInSection(section.branchSectionId, folderId, visibleOnly)
        }

        return GuideImageRepository.getLevel(section.branchSectionId, folderId)
    }

    static async getImage(imageId: number): Promise<GuideImageRecord> {
        const image = await GuideImageRepository.getImageById(imageId)

        if (!image) {
            throw new GuideImageNotFoundError()
        }

        return image
    }

    static async createImage(section: BranchSectionView, data: CreateGuideImageInput, uploadedBy: number): Promise<GuideImageRecord> {
        const folderId = data.folderId ?? null

        if (!section.isActive) {
            throw new InactiveGuideParentError()
        }

        if (folderId !== null && !(await GuideFolderRepository.getFolderInSection(section.branchSectionId, folderId)).view.isActive) {
            throw new InactiveGuideParentError()
        }

        await verifyGuideUpload(data.photoKey, data.thumbKey, section.branchSectionId)

        try {
            return await GuideImageRepository.createImage({
                branchSectionId: section.branchSectionId,
                folderId,
                title: data.title ?? null,
                storageKey: data.photoKey,
                thumbKey: data.thumbKey,
                uploadedBy,
            })
        } catch (error) {
            await GuideImageService.discardUnlessInUse(error, data.photoKey, data.thumbKey)
            throw error
        }
    }

    /** Retitle and/or replace. A replace commits the new keys (version + 1) before the old files are deleted. */
    static async updateImage(image: GuideImageRecord, data: UpdateGuideImageInput): Promise<GuideImageRecord> {
        // keys only ever come as an issued pair (verifyGuideUpload), so re-sending the current pair is
        // the one way to name a current file; that is a no-op, or the cleanup below would delete it
        const files = data.photoKey !== undefined && data.thumbKey !== undefined && data.photoKey !== image.storageKey
            ? { storageKey: data.photoKey, thumbKey: data.thumbKey }
            : undefined

        if (files) {
            await verifyGuideUpload(files.storageKey, files.thumbKey, image.view.branchSectionId)
        }

        let updated: GuideImageRecord
        try {
            updated = await GuideImageRepository.updateImage(image.view.imageId, { title: data.title, files })
        } catch (error) {
            if (files) {
                await GuideImageService.discardUnlessInUse(error, files.storageKey, files.thumbKey)
            }
            throw error
        }

        if (files) {
            await deletePhoto(image.storageKey)
            await deletePhoto(image.thumbKey)
        }

        return updated
    }

    /** Gone for good: the row first, then both files, so a failed delete never leaves a row pointing at nothing. */
    static async deleteImage(imageId: number): Promise<void> {
        const deleted = await GuideImageRepository.deleteImage(imageId)

        if (!deleted) {
            throw new GuideImageNotFoundError()
        }

        await deletePhoto(deleted.storageKey)
        await deletePhoto(deleted.thumbKey)
    }

    static async reorderImages(section: BranchSectionView, folderId: number | null, imageIds: number[]): Promise<GuideImageRecord[]> {
        if (folderId !== null) {
            await GuideFolderRepository.getFolderInSection(section.branchSectionId, folderId)
        }

        await GuideImageRepository.reorderLevel(section.branchSectionId, folderId, imageIds)
        return GuideImageRepository.getLevel(section.branchSectionId, folderId)
    }

    /**
     * The upload happened but the row didn't land: don't leave the files unreferenced. Except when
     * the keys are already in use — a retry or double submit whose first attempt won owns them now.
     */
    private static async discardUnlessInUse(error: unknown, photoKey: string, thumbKey: string): Promise<void> {
        if (!(error instanceof GuidePhotoKeyInUseError)) {
            await deletePhoto(photoKey)
            await deletePhoto(thumbKey)
        }
    }
}
