import { isSameIdSet } from '@/lib/guide-order'

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
