import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the services would reach for Prisma and R2.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/task-instance-service', () => ({ TaskInstanceService: { getTaskInstanceById: jest.fn() } }))
jest.mock('@/services/guide-image-service', () => ({ GuideImageService: { getTaskReferenceImages: jest.fn() } }))

import { getCurrentUser } from '@/lib/auth'
import { TaskInstanceService } from '@/services/task-instance-service'
import { GuideImageService } from '@/services/guide-image-service'
import { GET } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedGetInstance = TaskInstanceService.getTaskInstanceById as jest.Mock
const mockedGetImages = GuideImageService.getTaskReferenceImages as jest.Mock

const staff: AccessTokenPayload = { userId: 5, role: 'cashier', branchIds: [1] }
const reference = { branch_section_id: 4, folder_id: 9, name: 'Dairy fridge › Top shelf' }

const instance = (overrides: { assignee?: number; reference?: typeof reference | null } = {}) => ({
    completed_by: null,
    assignee: { user_id: overrides.assignee ?? 5, name: 'Rami' },
    task: { branch_id: 1, assigned_role_id: null, reference: overrides.reference === undefined ? reference : overrides.reference },
})

function call(instanceId = '12') {
    const req = new NextRequest(`http://localhost/api/task-instances/${instanceId}/reference`)
    return GET(req, { params: Promise.resolve({ instanceId }) } as never)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(staff)
})

describe('GET /api/task-instances/:id/reference', () => {
    it("returns the photos at the task's reference level to someone on the task", async () => {
        mockedGetInstance.mockResolvedValue(instance())
        mockedGetImages.mockResolvedValue([{ imageId: 30 }])

        const res = await call()

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([{ imageId: 30 }])
        expect(mockedGetImages).toHaveBeenCalledWith(reference, 12)
    })

    it('answers [] for a task with no reference', async () => {
        mockedGetInstance.mockResolvedValue(instance({ reference: null }))

        expect(await (await call()).json()).toEqual([])
        expect(mockedGetImages).not.toHaveBeenCalled()
    })

    it("refuses someone who isn't on the task", async () => {
        mockedGetInstance.mockResolvedValue(instance({ assignee: 6 }))

        expect((await call()).status).toBe(403)
        expect(mockedGetImages).not.toHaveBeenCalled()
    })

    it('answers 404 for an unknown instance and 400 for a malformed id', async () => {
        mockedGetInstance.mockResolvedValue(null)

        expect((await call()).status).toBe(404)
        expect((await call('abc')).status).toBe(400)
    })
})
