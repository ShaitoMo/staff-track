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
jest.mock('@/services/task-instance-service', () => ({ TaskInstanceService: { getTaskInstanceById: jest.fn() } }))

import { getCurrentUser } from '@/lib/auth'
import { getPhotoViewUrl } from '@/lib/storage'
import { GuideImageService } from '@/services/guide-image-service'
import { TaskInstanceService } from '@/services/task-instance-service'
import { GuideImageNotFoundError } from '@/exceptions/guide-image-not-found-error'
import { GET } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedGetImage = GuideImageService.getImage as jest.Mock
const mockedGetPhotoViewUrl = getPhotoViewUrl as jest.Mock
const mockedGetInstance = TaskInstanceService.getTaskInstanceById as jest.Mock

const staff: AccessTokenPayload = { userId: 5, role: 'cashier', branchIds: [1] }
const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }

const image = (overrides: Partial<{ branchId: number; visibleToStaff: boolean }> = {}) => ({
    view: { imageId: 30, branchSectionId: 4, folderId: 9 },
    branchId: 1,
    storageKey: 'guide/sections/4/a.jpg',
    thumbKey: 'guide/sections/4/a-thumb.jpg',
    visibleToStaff: true,
    ...overrides,
})

function call(imageId = '30', query = '') {
    const req = new NextRequest(`http://localhost/api/guide-images/${imageId}/file${query}`)
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

    describe('through a task (?instance=)', () => {
        // staff member 5 is the task's named assignee, so requireTaskInstanceAccess lets them in
        const instance = (reference: { branch_section_id: number; folder_id: number | null } | null, assignee = 5) => ({
            completed_by: null,
            assignee: { user_id: assignee, name: 'Rami' },
            task: { branch_id: 1, assigned_role_id: null, reference: reference && { ...reference, name: 'Dairy fridge › Top shelf' } },
        })

        beforeEach(() => {
            mockedGetImage.mockResolvedValue(image({ visibleToStaff: false }))
        })

        it("serves a photo the guide hides when the caller's task references its level", async () => {
            mockedGetInstance.mockResolvedValue(instance({ branch_section_id: 4, folder_id: 9 }))

            expect((await call('30', '?v=1&instance=12')).status).toBe(302)
            expect(mockedGetInstance).toHaveBeenCalledWith(12)
        })

        it('still hides it when the task references another level, or someone else has the task', async () => {
            mockedGetInstance.mockResolvedValueOnce(instance({ branch_section_id: 4, folder_id: null }))
            expect((await call('30', '?instance=12')).status).toBe(404)

            mockedGetInstance.mockResolvedValueOnce(instance({ branch_section_id: 4, folder_id: 9 }, 6))
            expect((await call('30', '?instance=12')).status).toBe(404)
        })

        it('still hides it for an unknown instance or one with no reference', async () => {
            mockedGetInstance.mockResolvedValueOnce(null)
            expect((await call('30', '?instance=12')).status).toBe(404)

            mockedGetInstance.mockResolvedValueOnce(instance(null))
            expect((await call('30', '?instance=12')).status).toBe(404)
        })

        it('does not look the task up for a photo staff may already see', async () => {
            mockedGetImage.mockResolvedValue(image())

            expect((await call('30', '?instance=12')).status).toBe(302)
            expect(mockedGetInstance).not.toHaveBeenCalled()
        })

        it("never looks the task up for a manager, who sees hidden photos anyway", async () => {
            mockedGetCurrentUser.mockReturnValue(manager)

            expect((await call('30', '?instance=12')).status).toBe(302)
            expect(mockedGetInstance).not.toHaveBeenCalled()
        })
    })
})
