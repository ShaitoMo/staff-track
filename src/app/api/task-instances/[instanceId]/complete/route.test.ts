import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service, storage and logger would reach for Prisma, S3 and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/lib/storage', () => ({ InvalidPhotoError: class InvalidPhotoError extends Error {} }))
jest.mock('@/services/task-instance-service', () => ({
    TaskInstanceService: { completeInstance: jest.fn(), getTaskInstanceById: jest.fn() },
}))

import { getCurrentUser } from '@/lib/auth'
import { TaskInstanceService } from '@/services/task-instance-service'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { InactiveTaskError } from '@/exceptions/inactive-task-error'
import { NotAssignedToTaskError } from '@/exceptions/forbidden-error'
import { PATCH } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedComplete = TaskInstanceService.completeInstance as jest.Mock
const mockedGetInstance = TaskInstanceService.getTaskInstanceById as jest.Mock

const staff: AccessTokenPayload = { userId: 5, role: 'cashier', branchIds: [1] }

function complete() {
    const req = new NextRequest('http://localhost/api/task-instances/4/complete', {
        method: 'PATCH',
        body: JSON.stringify({ photo_key: 'task-instances/4/photo.jpg' }),
    })
    return PATCH(req, { params: Promise.resolve({ instanceId: '4' }) } as never)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(staff)
})

describe('PATCH /api/task-instances/:instanceId/complete conflicts', () => {
    it('answers a teammate completing it first with INSTANCE_ALREADY_COMPLETED and its current state', async () => {
        mockedComplete.mockRejectedValue(new InvalidStatusTransitionError('completed', 'completed'))
        mockedGetInstance.mockResolvedValue({
            status: 'completed',
            completed_by_name: 'Omar',
            completed_at: new Date('2026-11-26T09:15:00Z'),
        })

        const res = await complete()

        expect(res.status).toBe(409)
        expect(await res.json()).toMatchObject({
            code: 'INSTANCE_ALREADY_COMPLETED',
            current: { status: 'completed', completed_by_name: 'Omar', completed_at: '2026-11-26T09:15:00.000Z' },
        })
    })

    it('keeps its own code, with no state, when the task was turned off', async () => {
        mockedComplete.mockRejectedValue(new InactiveTaskError())

        const res = await complete()

        expect(res.status).toBe(409)
        const body = await res.json()
        expect(body.code).toBe('TASK_INACTIVE')
        expect(body).not.toHaveProperty('current')
    })

    it('names a refusal to someone who is not the assignee NOT_ASSIGNEE', async () => {
        mockedComplete.mockRejectedValue(new NotAssignedToTaskError())

        const res = await complete()

        expect(res.status).toBe(403)
        expect(await res.json()).toMatchObject({ code: 'NOT_ASSIGNEE' })
    })
})
