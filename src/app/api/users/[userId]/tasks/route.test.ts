import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/task-instance-service', () => ({
    TaskInstanceService: { getTaskInstancesForUser: jest.fn() },
}))
jest.mock('@/services/user-branch-service', () => ({
    UserBranchService: { getUserBranches: jest.fn() },
}))

import { getCurrentUser } from '@/lib/auth'
import { TaskInstanceService } from '@/services/task-instance-service'
import { UserBranchService } from '@/services/user-branch-service'
import { GET } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedGetInstances = TaskInstanceService.getTaskInstancesForUser as jest.Mock
const mockedGetUserBranches = UserBranchService.getUserBranches as jest.Mock

const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }
const staff: AccessTokenPayload = { userId: 5, role: 'staff', branchIds: [1] }
const owner: AccessTokenPayload = { userId: 1, role: 'owner', branchIds: [] }

const inBranch = { instance_id: 10, task: { branch_id: 1 } }
const otherBranch = { instance_id: 11, task: { branch_id: 2 } }

function call(targetUserId: number) {
    const req = new NextRequest(`http://localhost/api/users/${targetUserId}/tasks`)
    const ctx = { params: Promise.resolve({ userId: String(targetUserId) }) }
    return GET(req, ctx as never)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetInstances.mockResolvedValue([inBranch, otherBranch])
})

describe('GET /api/users/:userId/tasks', () => {
    it('lets a worker read their own list without a branch lookup', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)

        const res = await call(5)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([inBranch, otherBranch])
        expect(mockedGetUserBranches).not.toHaveBeenCalled()
    })

    it("refuses a worker reading someone else's list", async () => {
        mockedGetCurrentUser.mockReturnValue(staff)

        const res = await call(6)

        expect(res.status).toBe(403)
        expect(mockedGetInstances).not.toHaveBeenCalled()
    })

    it('gives an owner the unfiltered list for any user', async () => {
        mockedGetCurrentUser.mockReturnValue(owner)

        const res = await call(5)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([inBranch, otherBranch])
    })

    it("hides a shared worker's tasks at branches the manager does not manage", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetUserBranches.mockResolvedValue([{ branchId: 1 }, { branchId: 2 }])

        const res = await call(5)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([inBranch])
    })

    it('refuses a manager reading a worker who shares none of their branches', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetUserBranches.mockResolvedValue([{ branchId: 2 }])

        const res = await call(5)

        expect(res.status).toBe(403)
        expect(mockedGetInstances).not.toHaveBeenCalled()
    })

    it('refuses a manager reading a user with no branches at all', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetUserBranches.mockResolvedValue([])

        const res = await call(5)

        expect(res.status).toBe(403)
        expect(mockedGetInstances).not.toHaveBeenCalled()
    })

    it('leaves a manager’s own list unfiltered', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)

        const res = await call(2)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([inBranch, otherBranch])
    })
})
