import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the access helper and storage would reach for Prisma and disk.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/lib/media-access', () => ({ requireMediaAccess: jest.fn() }))
jest.mock('@/lib/storage', () => ({
    ...jest.requireActual('@/lib/storage'),
    readPhoto: jest.fn(),
}))

import { getCurrentUser } from '@/lib/auth'
import { requireMediaAccess } from '@/lib/media-access'
import { PhotoNotFoundError, readPhoto } from '@/lib/storage'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'
import { GET } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedRequireMediaAccess = requireMediaAccess as jest.Mock
const mockedReadPhoto = readPhoto as jest.Mock

const staff: AccessTokenPayload = { userId: 5, role: 'staff', branchIds: [1] }

function call(mediaId = '12') {
    const req = new NextRequest(`http://localhost/api/media/${mediaId}/file`)
    return GET(req, { params: Promise.resolve({ mediaId }) } as never)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(staff)
    mockedRequireMediaAccess.mockResolvedValue({ media_id: 12, task_instance_id: 3, file_path: '/uploads/a.jpg' })
    mockedReadPhoto.mockResolvedValue({ data: Buffer.from([1, 2, 3]), contentType: 'image/jpeg' })
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

    it('serves the bytes with a private, non-sniffable response', async () => {
        const res = await call()

        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('image/jpeg')
        expect(res.headers.get('Content-Length')).toBe('3')
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
        expect(res.headers.get('Cache-Control')).toContain('private')
        expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3])
        expect(mockedReadPhoto).toHaveBeenCalledWith('/uploads/a.jpg')
    })

    it('does not read the file when the caller may not see the instance', async () => {
        mockedRequireMediaAccess.mockRejectedValue(new ForbiddenError())

        expect((await call()).status).toBe(403)
        expect(mockedReadPhoto).not.toHaveBeenCalled()
    })

    it('returns 404 for an unknown media id', async () => {
        mockedRequireMediaAccess.mockRejectedValue(new MediaNotFoundError())

        expect((await call()).status).toBe(404)
    })

    it('returns 404 when the record exists but the file is gone', async () => {
        mockedReadPhoto.mockRejectedValue(new PhotoNotFoundError())

        expect((await call()).status).toBe(404)
    })

    it('returns 500 for an unexpected failure', async () => {
        mockedReadPhoto.mockRejectedValue(new Error('disk on fire'))

        expect((await call()).status).toBe(500)
    })
})
