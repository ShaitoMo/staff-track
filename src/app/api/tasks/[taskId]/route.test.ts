import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/task-service', () => ({
    TaskService: { getTaskById: jest.fn(), updateTask: jest.fn() },
}))

import { getCurrentUser } from '@/lib/auth'
import { TaskService } from '@/services/task-service'
import { GET, PATCH } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedGetTaskById = TaskService.getTaskById as jest.Mock
const mockedUpdateTask = TaskService.updateTask as jest.Mock

const owner: AccessTokenPayload = { userId: 1, role: 'owner', branchIds: [] }
const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }
const staff: AccessTokenPayload = { userId: 5, role: 'staff', branchIds: [1] }

const task = { task_id: 9, branch_id: 1, title: 'Old' }

function patch(body: unknown = { title: 'New' }) {
    const req = new NextRequest('http://localhost/api/tasks/9', {
        method: 'PATCH',
        body: JSON.stringify(body),
    })
    return PATCH(req, { params: Promise.resolve({ taskId: '9' }) } as never)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetTaskById.mockResolvedValue(task)
    mockedUpdateTask.mockResolvedValue({ ...task, title: 'New' })
})

function get() {
    const req = new NextRequest('http://localhost/api/tasks/9')
    return GET(req, { params: Promise.resolve({ taskId: '9' }) } as never)
}

describe('GET /api/tasks/:taskId', () => {
    it('refuses staff before reading the task, so they cannot probe which ids exist', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)

        const res = await get()

        expect(res.status).toBe(403)
        expect(mockedGetTaskById).not.toHaveBeenCalled()
    })

    it("refuses a manager reading another branch's task", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetTaskById.mockResolvedValue({ ...task, branch_id: 2 })

        const res = await get()

        expect(res.status).toBe(403)
    })

    it('returns 404 for a task that does not exist', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetTaskById.mockResolvedValue(null)

        const res = await get()

        expect(res.status).toBe(404)
    })

    it('lets a manager read a task at their own branch', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)

        const res = await get()

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(task)
    })
})

describe('PATCH /api/tasks/:taskId', () => {
    it('returns 400 for a JSON null body instead of throwing', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)

        const res = await patch(null)

        expect(res.status).toBe(400)
        expect(mockedUpdateTask).not.toHaveBeenCalled()
    })

    it('refuses staff before reading the task, so they cannot probe which ids exist', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)

        const res = await patch()

        expect(res.status).toBe(403)
        expect(mockedGetTaskById).not.toHaveBeenCalled()
        expect(mockedUpdateTask).not.toHaveBeenCalled()
    })

    it("refuses a manager editing another branch's task", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetTaskById.mockResolvedValue({ ...task, branch_id: 2 })

        const res = await patch()

        expect(res.status).toBe(403)
        expect(mockedUpdateTask).not.toHaveBeenCalled()
    })

    it('returns 404 for a task that does not exist', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetTaskById.mockResolvedValue(null)

        const res = await patch()

        expect(res.status).toBe(404)
    })

    it('returns 500 rather than throwing when the task lookup fails', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetTaskById.mockRejectedValue(new Error('db down'))

        const res = await patch()

        expect(res.status).toBe(500)
    })

    it('lets a manager update a task at their own branch', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)

        const res = await patch()

        expect(res.status).toBe(200)
        expect(mockedUpdateTask).toHaveBeenCalledWith(9, { title: 'New' })
    })

    it('lets an owner update a task at any branch', async () => {
        mockedGetCurrentUser.mockReturnValue(owner)
        mockedGetTaskById.mockResolvedValue({ ...task, branch_id: 2 })

        const res = await patch()

        expect(res.status).toBe(200)
    })
})
