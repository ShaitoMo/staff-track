import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the access helper and storage would reach for Prisma and R2.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/lib/media-access', () => ({ requireMediaAccess: jest.fn() }))
jest.mock('@/lib/storage', () => ({ getPhotoViewUrl: jest.fn(), photoExists: jest.fn() }))

import { getCurrentUser } from '@/lib/auth'
import { requireMediaAccess } from '@/lib/media-access'
import { getPhotoViewUrl, photoExists } from '@/lib/storage'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'
import { GET } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedRequireMediaAccess = requireMediaAccess as jest.Mock
const mockedGetPhotoViewUrl = getPhotoViewUrl as jest.Mock
const mockedPhotoExists = photoExists as jest.Mock

const staff: AccessTokenPayload = { userId: 5, role: 'staff', branchIds: [1] }
const SIGNED_URL = 'https://acct.r2.cloudflarestorage.com/photos/task-instances/3/a.jpg?X-Amz-Signature=x'

function call(mediaId = '12', headers: Record<string, string> = {}) {
    const req = new NextRequest(`http://localhost/api/media/${mediaId}/file`, { headers })
    return GET(req, { params: Promise.resolve({ mediaId }) } as never)
}

/** What a browser sends when the photo link opens in a new tab, as opposed to an <img> load. */
function openAsPage(mediaId = '12') {
    return call(mediaId, { 'sec-fetch-dest': 'document' })
}

function redirectPath(res: Response) {
    return new URL(res.headers.get('Location')!).pathname
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(staff)
    mockedRequireMediaAccess.mockResolvedValue({ media_id: 12, task_instance_id: 3, file_path: 'task-instances/3/a.jpg' })
    mockedGetPhotoViewUrl.mockResolvedValue(SIGNED_URL)
    mockedPhotoExists.mockResolvedValue(true)
})

describe('GET /api/media/:mediaId/file', () => {
    it('refuses a request with no session', async () => {
        mockedGetCurrentUser.mockReturnValue(null)

        expect((await call()).status).toBe(401)
    })

    it('rejects a malformed id', async () => {
        expect((await call('abc')).status).toBe(400)
        expect(mockedRequireMediaAccess).not.toHaveBeenCalled()
    })

    it('redirects to an uncached signed URL for the stored key', async () => {
        const res = await call()

        expect(res.status).toBe(302)
        expect(res.headers.get('Location')).toBe(SIGNED_URL)
        expect(res.headers.get('Cache-Control')).toBe('no-store')
        expect(mockedGetPhotoViewUrl).toHaveBeenCalledWith('task-instances/3/a.jpg')
    })

    it('does not check the bucket for an <img> load', async () => {
        await call('12', { 'sec-fetch-dest': 'image' })

        expect(mockedPhotoExists).not.toHaveBeenCalled()
    })

    it('does not sign a URL when the caller may not see the instance', async () => {
        mockedRequireMediaAccess.mockRejectedValue(new ForbiddenError())

        expect((await call()).status).toBe(403)
        expect(mockedGetPhotoViewUrl).not.toHaveBeenCalled()
    })

    it('returns 404 for an unknown media id', async () => {
        mockedRequireMediaAccess.mockRejectedValue(new MediaNotFoundError())

        expect((await call()).status).toBe(404)
    })

    it('returns 500 for an unexpected failure', async () => {
        mockedGetPhotoViewUrl.mockRejectedValue(new Error('R2 down'))

        expect((await call()).status).toBe(500)
    })

    describe('opened as a page', () => {
        it('sends an unknown media id to the photo-unavailable page', async () => {
            mockedRequireMediaAccess.mockRejectedValue(new MediaNotFoundError())

            const res = await openAsPage()

            expect(res.status).toBe(307)
            expect(redirectPath(res)).toBe('/photo-unavailable')
        })

        it('sends a refused caller to the same page, without signing a URL', async () => {
            mockedRequireMediaAccess.mockRejectedValue(new ForbiddenError())

            const res = await openAsPage()

            expect(redirectPath(res)).toBe('/photo-unavailable')
            expect(mockedGetPhotoViewUrl).not.toHaveBeenCalled()
        })

        it('sends a photo whose file is gone from the bucket to the same page', async () => {
            mockedPhotoExists.mockResolvedValue(false)

            const res = await openAsPage()

            expect(redirectPath(res)).toBe('/photo-unavailable')
            expect(mockedPhotoExists).toHaveBeenCalledWith('task-instances/3/a.jpg')
        })

        it('recognises a page load by Accept alone, since browsers omit Sec-Fetch-* over plain HTTP', async () => {
            mockedRequireMediaAccess.mockRejectedValue(new MediaNotFoundError())

            const res = await call('12', { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' })

            expect(redirectPath(res)).toBe('/photo-unavailable')
        })

        it('still redirects a photo that is there to its signed URL', async () => {
            const res = await openAsPage()

            expect(res.status).toBe(302)
            expect(res.headers.get('Location')).toBe(SIGNED_URL)
        })
    })
})
