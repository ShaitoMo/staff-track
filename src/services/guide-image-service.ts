import { GuideFolderRepository } from '@/repository/guide-folder-repository'
import { GuideImageRecord, GuideImageRepository } from '@/repository/guide-image-repository'
import { createGuideUploadUrls, deletePhoto, verifyGuidePhoto } from '@/lib/storage'
import {
    BranchSectionView,
    CreateGuideImageInput,
    GuideUploadView,
    UpdateGuideImageInput,
} from '@/types/shelf-guide'
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error'
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

    static async getImages(section: BranchSectionView, folderId: number | null): Promise<GuideImageRecord[]> {
        if (folderId !== null) {
            await GuideImageService.getFolderInSection(section.branchSectionId, folderId)
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

        if (folderId !== null && !(await GuideImageService.getFolderInSection(section.branchSectionId, folderId)).view.isActive) {
            throw new InactiveGuideParentError()
        }

        await GuideImageService.verifyUpload(section.branchSectionId, data.photoKey, data.thumbKey)

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
        if (image.view.isDeleted) {
            throw new GuideImageNotFoundError()
        }

        // a replace needs a fresh pair from photo-upload; re-sending a current key would make the
        // cleanup below delete a file the photo still uses, so the file part is ignored then
        const files = data.photoKey !== undefined && data.thumbKey !== undefined
            && data.photoKey !== image.storageKey && data.thumbKey !== image.thumbKey
            ? { storageKey: data.photoKey, thumbKey: data.thumbKey }
            : undefined

        if (files) {
            await GuideImageService.verifyUpload(image.view.branchSectionId, files.storageKey, files.thumbKey)
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

    /** To the recycle bin. The files stay until the bin is purged, so a restore can bring the photo back. */
    static async deleteImage(imageId: number): Promise<void> {
        if (!await GuideImageRepository.recycleImage(imageId, new Date())) {
            throw new GuideImageNotFoundError()
        }
    }

    static async reorderImages(section: BranchSectionView, folderId: number | null, imageIds: number[]): Promise<GuideImageRecord[]> {
        if (folderId !== null) {
            await GuideImageService.getFolderInSection(section.branchSectionId, folderId)
        }

        await GuideImageRepository.reorderLevel(section.branchSectionId, folderId, imageIds)
        return GuideImageRepository.getLevel(section.branchSectionId, folderId)
    }

    private static async getFolderInSection(branchSectionId: number, folderId: number) {
        const folder = await GuideFolderRepository.getFolderById(folderId)

        if (!folder || folder.view.branchSectionId !== branchSectionId) {
            throw new GuideFolderNotFoundError()
        }

        return folder
    }

    /** Both keys must be this section's and really uploaded as JPEGs; an invalid object is deleted by the check itself. */
    private static async verifyUpload(branchSectionId: number, photoKey: string, thumbKey: string): Promise<void> {
        await verifyGuidePhoto(photoKey, branchSectionId)
        await verifyGuidePhoto(thumbKey, branchSectionId)
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
