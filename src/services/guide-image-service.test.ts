jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/guide-image-repository', () => ({
    GuideImageRepository: { createImage: jest.fn(), updateImage: jest.fn(), deleteImage: jest.fn(), getLevel: jest.fn() },
}));
jest.mock('@/repository/guide-folder-repository', () => ({
    GuideFolderRepository: { getFolderInSection: jest.fn() },
}));
jest.mock('@/lib/storage', () => ({
    createGuideUploadUrls: jest.fn(),
    verifyGuideUpload: jest.fn(),
    deletePhoto: jest.fn(),
}));

import { GuideImageService } from '@/services/guide-image-service';
import { GuideImageRecord, GuideImageRepository } from '@/repository/guide-image-repository';
import { GuideFolderRepository } from '@/repository/guide-folder-repository';
import { deletePhoto, verifyGuideUpload } from '@/lib/storage';
import { BranchSectionView } from '@/types/shelf-guide';
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error';
import { GuideImageNotFoundError } from '@/exceptions/guide-image-not-found-error';
import { GuidePhotoKeyInUseError } from '@/exceptions/guide-photo-key-in-use-error';
import { InactiveGuideParentError } from '@/exceptions/inactive-guide-parent-error';

const createImage = GuideImageRepository.createImage as jest.Mock;
const updateImage = GuideImageRepository.updateImage as jest.Mock;
const deleteImage = GuideImageRepository.deleteImage as jest.Mock;
const getFolderInSection = GuideFolderRepository.getFolderInSection as jest.Mock;
const verify = verifyGuideUpload as jest.Mock;
const remove = deletePhoto as jest.Mock;

const section = (overrides: Partial<BranchSectionView> = {}): BranchSectionView => ({
    branchSectionId: 4,
    branchId: 1,
    branchName: 'Hamra',
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
        fileUrl: '',
        thumbUrl: '',
        ...overrides,
    },
    branchId: 1,
    storageKey: 'guide/sections/4/old.jpg',
    thumbKey: 'guide/sections/4/old-thumb.jpg',
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

        expect(verify).toHaveBeenCalledWith(keys.photoKey, keys.thumbKey, 4);
        expect(createImage).toHaveBeenCalledWith({
            branchSectionId: 4, folderId: null, title: 'Front', storageKey: keys.photoKey, thumbKey: keys.thumbKey, uploadedBy: 7,
        });
    });

    it('refuses an inactive section or folder before looking at the upload', async () => {
        await expect(GuideImageService.createImage(section({ isActive: false }), keys, 7)).rejects.toThrow(InactiveGuideParentError);

        getFolderInSection.mockResolvedValue(folder(4, false));
        await expect(GuideImageService.createImage(section(), { ...keys, folderId: 9 }, 7)).rejects.toThrow(InactiveGuideParentError);

        expect(verify).not.toHaveBeenCalled();
    });

    it("checks the folder belongs to this section", async () => {
        getFolderInSection.mockRejectedValue(new GuideFolderNotFoundError());

        await expect(GuideImageService.createImage(section(), { ...keys, folderId: 9 }, 7)).rejects.toThrow(GuideFolderNotFoundError);
        expect(getFolderInSection).toHaveBeenCalledWith(4, 9);
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

    it('only retitles when the current pair is sent back, so no file is deleted', async () => {
        updateImage.mockResolvedValue(image());

        await GuideImageService.updateImage(image(), { title: 'Back', photoKey: 'guide/sections/4/old.jpg', thumbKey: 'guide/sections/4/old-thumb.jpg' });

        expect(updateImage).toHaveBeenCalledWith(30, { title: 'Back', files: undefined });
        expect(remove).not.toHaveBeenCalled();
    });
});

describe('GuideImageService.deleteImage', () => {
    it('deletes the row, then both files', async () => {
        deleteImage.mockResolvedValue({ storageKey: 'guide/sections/4/old.jpg', thumbKey: 'guide/sections/4/old-thumb.jpg' });

        await GuideImageService.deleteImage(30);

        expect(deleteImage).toHaveBeenCalledWith(30);
        expect(remove.mock.calls).toEqual([['guide/sections/4/old.jpg'], ['guide/sections/4/old-thumb.jpg']]);
        expect(deleteImage.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
    });

    it('reports a photo that is already gone as missing', async () => {
        deleteImage.mockResolvedValue(null);

        await expect(GuideImageService.deleteImage(30)).rejects.toThrow(GuideImageNotFoundError);
        expect(remove).not.toHaveBeenCalled();
    });
});

describe('GuideImageService.getTaskReferenceImages', () => {
    it("reads the task's level and tags both URLs with the instance, keeping the version", async () => {
        (GuideImageRepository.getLevel as jest.Mock).mockResolvedValue([
            image({ fileUrl: '/api/guide-images/30/file?v=2', thumbUrl: '/api/guide-images/30/thumb?v=2' }),
        ]);

        const [view] = await GuideImageService.getTaskReferenceImages({ branch_section_id: 4, folder_id: 9, name: 'x' }, 12);

        expect(GuideImageRepository.getLevel).toHaveBeenCalledWith(4, 9);
        expect(view.fileUrl).toBe('/api/guide-images/30/file?v=2&instance=12');
        expect(view.thumbUrl).toBe('/api/guide-images/30/thumb?v=2&instance=12');
    });
});
