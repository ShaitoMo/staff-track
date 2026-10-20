jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/guide-image-repository', () => ({
    GuideImageRepository: { createImage: jest.fn(), updateImage: jest.fn(), recycleImage: jest.fn() },
}));
jest.mock('@/repository/guide-folder-repository', () => ({
    GuideFolderRepository: { getFolderById: jest.fn() },
}));
jest.mock('@/lib/storage', () => ({
    createGuideUploadUrls: jest.fn(),
    verifyGuidePhoto: jest.fn(),
    deletePhoto: jest.fn(),
}));

import { GuideImageService } from '@/services/guide-image-service';
import { GuideImageRecord, GuideImageRepository } from '@/repository/guide-image-repository';
import { GuideFolderRepository } from '@/repository/guide-folder-repository';
import { deletePhoto, verifyGuidePhoto } from '@/lib/storage';
import { BranchSectionView } from '@/types/shelf-guide';
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error';
import { GuideImageNotFoundError } from '@/exceptions/guide-image-not-found-error';
import { GuidePhotoKeyInUseError } from '@/exceptions/guide-photo-key-in-use-error';
import { InactiveGuideParentError } from '@/exceptions/inactive-guide-parent-error';

const createImage = GuideImageRepository.createImage as jest.Mock;
const updateImage = GuideImageRepository.updateImage as jest.Mock;
const recycleImage = GuideImageRepository.recycleImage as jest.Mock;
const getFolderById = GuideFolderRepository.getFolderById as jest.Mock;
const verify = verifyGuidePhoto as jest.Mock;
const remove = deletePhoto as jest.Mock;

const section = (overrides: Partial<BranchSectionView> = {}): BranchSectionView => ({
    branchSectionId: 4,
    branchId: 1,
    sectionTypeId: 2,
    name: 'Dairy fridge',
    displayOrder: 0,
    isActive: true,
    ...overrides,
});

const folder = (branchSectionId: number, isActive = true) => ({ view: { folderId: 9, branchSectionId, isActive } });

const image = (overrides: Partial<GuideImageRecord['view']> = {}): GuideImageRecord => ({
    view: {
        imageId: 30,
        branchSectionId: 4,
        folderId: null,
        title: null,
        displayOrder: 0,
        version: 1,
        isDeleted: false,
        deletedAt: null,
        fileUrl: '',
        thumbUrl: '',
        ...overrides,
    },
    branchId: 1,
    storageKey: 'guide/sections/4/old.jpg',
    thumbKey: 'guide/sections/4/old-thumb.jpg',
    filesPurged: false,
    visibleToStaff: true,
});

const keys = { photoKey: 'guide/sections/4/new.jpg', thumbKey: 'guide/sections/4/new-thumb.jpg' };

beforeEach(() => {
    jest.resetAllMocks();
});

describe('GuideImageService.createImage', () => {
    it('verifies both uploaded files before adding the photo at the section root', async () => {
        createImage.mockResolvedValue(image());

        await GuideImageService.createImage(section(), { ...keys, title: 'Front' }, 7);

        expect(verify.mock.calls).toEqual([[keys.photoKey, 4], [keys.thumbKey, 4]]);
        expect(createImage).toHaveBeenCalledWith({
            branchSectionId: 4, folderId: null, title: 'Front', storageKey: keys.photoKey, thumbKey: keys.thumbKey, uploadedBy: 7,
        });
    });

    it('refuses an inactive section or folder before looking at the upload', async () => {
        await expect(GuideImageService.createImage(section({ isActive: false }), keys, 7)).rejects.toThrow(InactiveGuideParentError);

        getFolderById.mockResolvedValue(folder(4, false));
        await expect(GuideImageService.createImage(section(), { ...keys, folderId: 9 }, 7)).rejects.toThrow(InactiveGuideParentError);

        expect(verify).not.toHaveBeenCalled();
    });

    it("treats another section's folder as missing", async () => {
        getFolderById.mockResolvedValue(folder(5));

        await expect(GuideImageService.createImage(section(), { ...keys, folderId: 9 }, 7)).rejects.toThrow(GuideFolderNotFoundError);
    });

    it('deletes the uploaded files when the row does not land', async () => {
        createImage.mockRejectedValue(new Error('db down'));

        await expect(GuideImageService.createImage(section(), keys, 7)).rejects.toThrow('db down');
        expect(remove.mock.calls).toEqual([[keys.photoKey], [keys.thumbKey]]);
    });

    it('keeps the files when a retry finds them already used by the photo that won', async () => {
        createImage.mockRejectedValue(new GuidePhotoKeyInUseError());

        await expect(GuideImageService.createImage(section(), keys, 7)).rejects.toThrow(GuidePhotoKeyInUseError);
        expect(remove).not.toHaveBeenCalled();
    });
});

describe('GuideImageService.updateImage', () => {
    it('commits the new files, then deletes the old ones', async () => {
        updateImage.mockResolvedValue(image({ version: 2 }));

        await GuideImageService.updateImage(image(), keys);

        expect(updateImage).toHaveBeenCalledWith(30, { title: undefined, files: { storageKey: keys.photoKey, thumbKey: keys.thumbKey } });
        expect(remove.mock.calls).toEqual([['guide/sections/4/old.jpg'], ['guide/sections/4/old-thumb.jpg']]);
        expect(updateImage.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
    });

    it('only retitles when the current keys are sent back, so no file is deleted', async () => {
        updateImage.mockResolvedValue(image());

        await GuideImageService.updateImage(image(), { title: 'Back', photoKey: 'guide/sections/4/old.jpg', thumbKey: keys.thumbKey });

        expect(updateImage).toHaveBeenCalledWith(30, { title: 'Back', files: undefined });
        expect(remove).not.toHaveBeenCalled();
    });

    it('refuses to edit a photo in the recycle bin', async () => {
        await expect(GuideImageService.updateImage(image({ isDeleted: true }), { title: 'x' })).rejects.toThrow(GuideImageNotFoundError);
    });
});

describe('GuideImageService.deleteImage', () => {
    it('reports a photo already in the recycle bin as missing', async () => {
        recycleImage.mockResolvedValue(false);

        await expect(GuideImageService.deleteImage(30)).rejects.toThrow(GuideImageNotFoundError);
    });
});
