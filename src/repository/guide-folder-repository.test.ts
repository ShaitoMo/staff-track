// the module builds a PrismaPg adapter at import time; getFolderInSection only needs getFolderById, stubbed below
jest.mock('@/lib/db', () => ({ db: {} }));

import { GuideFolderRecord, GuideFolderRepository } from '@/repository/guide-folder-repository';
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error';

const record = (branchSectionId: number, visibleToStaff: boolean): GuideFolderRecord => ({
    view: { folderId: 9, branchSectionId, parentFolderId: null, name: 'Top shelf', displayOrder: 0, isActive: visibleToStaff },
    branchId: 1,
    sectionActive: true,
    parentActive: true,
    visibleToStaff,
});

const getFolderById = jest.spyOn(GuideFolderRepository, 'getFolderById');

beforeEach(() => {
    getFolderById.mockReset();
});

describe('GuideFolderRepository.getFolderInSection', () => {
    it('returns a folder of this section, active or not, for an editor', async () => {
        getFolderById.mockResolvedValue(record(4, false));

        await expect(GuideFolderRepository.getFolderInSection(4, 9)).resolves.toMatchObject({ view: { folderId: 9 } });
    });

    it("treats a missing folder, or another section's, as missing", async () => {
        getFolderById.mockResolvedValueOnce(null).mockResolvedValueOnce(record(5, true));

        await expect(GuideFolderRepository.getFolderInSection(4, 9)).rejects.toThrow(GuideFolderNotFoundError);
        await expect(GuideFolderRepository.getFolderInSection(4, 9)).rejects.toThrow(GuideFolderNotFoundError);
    });

    it('hides an inactive folder from a staff caller, so its existence is not confirmed', async () => {
        getFolderById.mockResolvedValue(record(4, false));

        await expect(GuideFolderRepository.getFolderInSection(4, 9, true)).rejects.toThrow(GuideFolderNotFoundError);
    });
});
