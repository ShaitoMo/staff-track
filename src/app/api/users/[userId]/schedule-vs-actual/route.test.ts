import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service would reach for Prisma.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/schedule-vs-actual-service', () => ({
    ScheduleVsActualService: { getScheduleVsActual: jest.fn() },
}))
jest.mock('@/services/user-branch-service', () => ({
    UserBranchService: { getUserBranches: jest.fn() },
}))
jest.mock('@/services/user-service', () => ({ UserService: {} }))

import { getCurrentUser } from '@/lib/auth'
import { ScheduleVsActualService } from '@/services/schedule-vs-actual-service'
import { UserBranchService } from '@/services/user-branch-service'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { GET } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedGetScheduleVsActual = ScheduleVsActualService.getScheduleVsActual as jest.Mock
const mockedGetUserBranches = UserBranchService.getUserBranches as jest.Mock

const staff: AccessTokenPayload = { userId: 5, role: 'staff', branchIds: [1] }
const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }

function call(userId = '5', query = '?from=2026-09-28&to=2026-10-04') {
    const req = new NextRequest(`http://localhost/api/users/${userId}/schedule-vs-actual${query}`)
    return GET(req, { params: Promise.resolve({ userId }) } as never)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(staff)
    // user 5 works branches 1 and 2
    mockedGetUserBranches.mockResolvedValue([{ branchId: 1 }, { branchId: 2 }])
    mockedGetScheduleVsActual.mockResolvedValue([
        { shift_id: 1, user_id: 5, branch_id: 1 },
        { shift_id: 2, user_id: 5, branch_id: 2 },
    ])
})

describe('GET /api/users/:userId/schedule-vs-actual', () => {
    it('refuses a request with no session', async () => {
        mockedGetCurrentUser.mockReturnValue(null)

        expect((await call()).status).toBe(401)
    })

    it('lets staff read their own rows, at every branch', async () => {
        const res = await call()

        expect(res.status).toBe(200)
        expect(await res.json()).toHaveLength(2)
        expect(mockedGetScheduleVsActual).toHaveBeenCalledWith(expect.objectContaining({ user_id: 5 }))
    })

    it('refuses staff reading someone else', async () => {
        expect((await call('6')).status).toBe(403)
        expect(mockedGetScheduleVsActual).not.toHaveBeenCalled()
    })

    it("shows a manager only the rows at their branches", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)

        const res = await call()

        expect(await res.json()).toEqual([{ shift_id: 1, user_id: 5, branch_id: 1 }])
    })

    it("refuses a manager asking about someone at none of their branches, before reading", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetUserBranches.mockResolvedValue([{ branchId: 3 }])

        expect((await call('7')).status).toBe(403)
        expect(mockedGetScheduleVsActual).not.toHaveBeenCalled()
    })

    it("gives a manager the same 403 for a user that doesn't exist", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetUserBranches.mockResolvedValue([])

        expect((await call('99')).status).toBe(403)
    })

    it('requires the date range', async () => {
        expect((await call('5', '?to=2026-10-04')).status).toBe(400)
    })

    it('rejects a malformed id', async () => {
        expect((await call('abc')).status).toBe(400)
    })

    it('returns 404 to an owner for an unknown user', async () => {
        mockedGetCurrentUser.mockReturnValue({ userId: 1, role: 'owner', branchIds: [] })
        mockedGetScheduleVsActual.mockRejectedValue(new UserNotFoundError())

        expect((await call('99')).status).toBe(404)
    })
})
