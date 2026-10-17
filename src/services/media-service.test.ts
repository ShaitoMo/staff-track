jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/media-repository', () => ({
    MediaRepository: { getReferencedFilePaths: jest.fn() },
}));
jest.mock('@/lib/storage', () => ({
    listPhotoKeys: jest.fn(),
    deletePhoto: jest.fn(),
}));

import { MediaService } from '@/services/media-service';
import { MediaRepository } from '@/repository/media-repository';
import { deletePhoto, listPhotoKeys } from '@/lib/storage';

const mockedList = listPhotoKeys as jest.Mock;
const mockedReferenced = MediaRepository.getReferencedFilePaths as jest.Mock;
const mockedDelete = deletePhoto as jest.Mock;

function pagesOf(...pages: string[][]) {
    return (async function* () {
        yield* pages;
    })();
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe('MediaService.sweepOrphanPhotos', () => {
    const now = new Date('2026-10-13T03:00:00Z');

    it('deletes only keys no media row points at, page by page', async () => {
        mockedList.mockReturnValue(pagesOf(['k/1.jpg', 'k/2.jpg'], ['k/3.jpg']));
        mockedReferenced
            .mockResolvedValueOnce(new Set(['k/1.jpg']))
            .mockResolvedValueOnce(new Set());

        const result = await MediaService.sweepOrphanPhotos(now);

        expect(mockedReferenced).toHaveBeenNthCalledWith(1, ['k/1.jpg', 'k/2.jpg']);
        expect(mockedReferenced).toHaveBeenNthCalledWith(2, ['k/3.jpg']);
        expect(mockedDelete.mock.calls).toEqual([['k/2.jpg'], ['k/3.jpg']]);
        expect(result).toEqual({ checked: 3, deleted: 2 });
    });

    it('only looks at photos at least a day old, so an upload still being completed is left alone', async () => {
        mockedList.mockReturnValue(pagesOf());

        await MediaService.sweepOrphanPhotos(now);

        expect(mockedList).toHaveBeenCalledWith(new Date('2026-10-12T03:00:00Z'));
    });

    it('skips the database for an empty page', async () => {
        mockedList.mockReturnValue(pagesOf([]));

        const result = await MediaService.sweepOrphanPhotos(now);

        expect(mockedReferenced).not.toHaveBeenCalled();
        expect(result).toEqual({ checked: 0, deleted: 0 });
    });
});
