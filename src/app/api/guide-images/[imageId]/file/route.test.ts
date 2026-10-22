import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and storage would reach for Prisma and R2.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/lib/storage', () => ({
    getPhotoViewUrl: jest.fn(),
    InvalidPhotoError: class InvalidPhotoError extends Error {},
}))
jest.mock('@/services/guide-image-service', () => ({ GuideImageService: { getImage: jest.fn() } }))

import { getCurrentUser } from '@/lib/auth'
import { getPhotoViewUrl } from '@/lib/storage'
import { GuideImageService } from '@/services/guide-image-service'
import { GuideImageNotFoundError } from '@/exceptions/guide-image-not-found-error'
import { GET } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedGetImage = GuideImageService.getImage as jest.Mock
const mockedGetPhotoViewUrl = getPhotoViewUrl as jest.Mock

const staff: AccessTokenPayload = { userId: 5, role: 'cashier', branchIds: [1] }
const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }

const image = (overrides: Partial<{ branchId: number; visibleToStaff: boolean }> = {}) => ({
    view: { imageId: 30 },
    branchId: 1,
    storageKey: 'guide/sections/4/a.jpg',
    thumbKey: 'guide/sections/4/a-thumb.jpg',
    visibleToStaff: true,
    ...overrides,
})

function call(imageId = '30') {
    const req = new NextRequest(`http://localhost/api/guide-images/${imageId}/file`)
    return GET(req, { params: Promise.resolve({ imageId }) } as never)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(staff)
    mockedGetPhotoViewUrl.mockResolvedValue('https://signed.example/a.jpg')
})

describe('GET /api/guide-images/:id/file', () => {
    it('redirects staff at the branch to an uncached signed URL for the full photo', async () => {
        mockedGetImage.mockResolvedValue(image())

        const res = await call()

        expect(res.status).toBe(302)
        expect(res.headers.get('Cache-Control')).toBe('no-store')
        expect(mockedGetPhotoViewUrl).toHaveBeenCalledWith('guide/sections/4/a.jpg')
    })

    it("answers 404, not 403, for another branch's photo", async () => {
        mockedGetImage.mockResolvedValue(image({ branchId: 2 }))

        expect((await call()).status).toBe(404)
        expect(mockedGetPhotoViewUrl).not.toHaveBeenCalled()
    })

    it('hides a photo in an inactive section or folder from staff but still serves it to a manager', async () => {
        mockedGetImage.mockResolvedValue(image({ visibleToStaff: false }))
        expect((await call()).status).toBe(404)

        mockedGetCurrentUser.mockReturnValue(manager)
        expect((await call()).status).toBe(302)
    })

    it('answers 404 for an unknown id', async () => {
        mockedGetImage.mockRejectedValue(new GuideImageNotFoundError())

        expect((await call()).status).toBe(404)
    })
})
