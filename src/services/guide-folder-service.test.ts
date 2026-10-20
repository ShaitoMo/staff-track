jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/guide-folder-repository', () => ({
    GuideFolderRepository: { getFolderInSection: jest.fn(), createFolder: jest.fn(), reactivateFolder: jest.fn() },
}));

import { GuideFolderService } from '@/services/guide-folder-service';
import { GuideFolderRecord, GuideFolderRepository } from '@/repository/guide-folder-repository';
import { BranchSectionView } from '@/types/shelf-guide';
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error';
import { InactiveGuideParentError } from '@/exceptions/inactive-guide-parent-error';

const getFolderInSection = GuideFolderRepository.getFolderInSection as jest.Mock;
const createFolder = GuideFolderRepository.createFolder as jest.Mock;
const reactivateFolder = GuideFolderRepository.reactivateFolder as jest.Mock;

const section = (isActive = true): BranchSectionView => ({
    branchSectionId: 4, branchId: 1, branchName: 'Hamra', sectionTypeId: 2, name: 'Dairy fridge', displayOrder: 0, isActive,
});

const folder = (overrides: Partial<GuideFolderRecord> & { branchSectionId?: number; isActive?: boolean } = {}): GuideFolderRecord => ({
    view: {
        folderId: 9,
        branchSectionId: overrides.branchSectionId ?? 4,
        parentFolderId: null,
        name: 'Top shelf',
        displayOrder: 0,
        isActive: overrides.isActive ?? true,
    },
    branchId: 1,
    sectionActive: overrides.sectionActive ?? true,
    parentActive: overrides.parentActive ?? true,
    visibleToStaff: (overrides.isActive ?? true) && (overrides.sectionActive ?? true),
});

beforeEach(() => {
    jest.resetAllMocks();
});

describe('GuideFolderService.createFolder', () => {
    it('creates at the section root when no parent is given', async () => {
        await GuideFolderService.createFolder(section(), { name: 'Top shelf' });

        expect(createFolder).toHaveBeenCalledWith({ branchSectionId: 4, parentFolderId: null, name: 'Top shelf' });
    });

    it('refuses to create inside an inactive section or under an inactive parent', async () => {
        await expect(GuideFolderService.createFolder(section(false), { name: 'x' })).rejects.toThrow(InactiveGuideParentError);

        getFolderInSection.mockResolvedValue(folder({ isActive: false }));
        await expect(GuideFolderService.createFolder(section(), { name: 'x', parentFolderId: 9 })).rejects.toThrow(InactiveGuideParentError);

        expect(createFolder).not.toHaveBeenCalled();
    });

    it("checks the parent belongs to this section", async () => {
        getFolderInSection.mockRejectedValue(new GuideFolderNotFoundError());

        await expect(GuideFolderService.createFolder(section(), { name: 'x', parentFolderId: 9 })).rejects.toThrow(GuideFolderNotFoundError);
        expect(getFolderInSection).toHaveBeenCalledWith(4, 9);
    });
});

describe('GuideFolderService.reactivateFolder', () => {
    it('refuses while its section or parent is still inactive', async () => {
        await expect(GuideFolderService.reactivateFolder(folder({ sectionActive: false }), false)).rejects.toThrow(InactiveGuideParentError);
        await expect(GuideFolderService.reactivateFolder(folder({ parentActive: false }), true)).rejects.toThrow(InactiveGuideParentError);
        expect(reactivateFolder).not.toHaveBeenCalled();
    });

    it('reactivates the subtree, passing on restoreImages', async () => {
        reactivateFolder.mockResolvedValue({ folders: 2, images: 3, permanentlyLost: 1 });

        await expect(GuideFolderService.reactivateFolder(folder(), true)).resolves.toEqual({ folders: 2, images: 3, permanentlyLost: 1 });
        expect(reactivateFolder).toHaveBeenCalledWith(9, 4, true, expect.any(Date));
    });
});
