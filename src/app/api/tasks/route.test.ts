import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/task-service', () => ({ TaskService: { createTask: jest.fn() } }))

import { getCurrentUser } from '@/lib/auth'
import { TaskService } from '@/services/task-service'
import { POST } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedCreateTask = TaskService.createTask as jest.Mock

const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }

const validBody = { title: 'Face the shelves', branch_id: 1, assigned_to: 5, due_date: '2026-12-01' }

function post(body: unknown) {
    const req = new NextRequest('http://localhost/api/tasks', { method: 'POST', body: JSON.stringify(body) })
    return POST(req)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(manager)
})

describe('POST /api/tasks validation', () => {
    it('marks a missing title as REQUIRED', async () => {
        const res = await post({ ...validBody, title: undefined })

        expect(res.status).toBe(400)
        expect(await res.json()).toMatchObject({
            code: 'VALIDATION_FAILED',
            fields: [{ path: 'title', code: 'REQUIRED' }],
        })
        expect(mockedCreateTask).not.toHaveBeenCalled()
    })

    it('puts the person-or-role rule on assigned_to as ASSIGNEE_XOR_ROLE', async () => {
        const res = await post({ ...validBody, assigned_role_id: 3 })

        expect(res.status).toBe(400)
        expect(await res.json()).toMatchObject({ fields: [{ path: 'assigned_to', code: 'ASSIGNEE_XOR_ROLE' }] })
    })

    it('reports several invalid fields at once', async () => {
        const res = await post({ ...validBody, title: '', branch_id: -1 })

        const body = await res.json()
        expect(body.fields).toEqual(expect.arrayContaining([
            { path: 'title', code: 'REQUIRED' },
            { path: 'branch_id', code: 'OUT_OF_RANGE' },
        ]))
    })
})
