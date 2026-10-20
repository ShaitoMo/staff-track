import { appendToLevels, isSameIdSet } from '@/lib/guide-order'

describe('appendToLevels', () => {
    it('appends after the highest live position of each level, one after another', () => {
        const items = [
            { imageId: 1, folderId: null },
            { imageId: 2, folderId: 7 },
            { imageId: 3, folderId: null },
        ]

        const placed = appendToLevels(items, new Map([[null, 4], [7, 0]]))

        expect(placed.map(p => [p.item.imageId, p.displayOrder])).toEqual([[1, 5], [2, 1], [3, 6]])
    })

    it('starts an empty level at 0', () => {
        const placed = appendToLevels([{ folderId: 9 }, { folderId: 9 }], new Map())

        expect(placed.map(p => p.displayOrder)).toEqual([0, 1])
    })
})

describe('isSameIdSet', () => {
    it('accepts the same ids in any order', () => {
        expect(isSameIdSet([3, 1, 2], [1, 2, 3])).toBe(true)
    })

    it('refuses a missing, extra or repeated id', () => {
        expect(isSameIdSet([1, 2], [1, 2, 3])).toBe(false)
        expect(isSameIdSet([1, 2, 3, 4], [1, 2, 3])).toBe(false)
        expect(isSameIdSet([1, 1, 2], [1, 2, 3])).toBe(false)
    })
})
