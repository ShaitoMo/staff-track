import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/schedule-rule-service', () => ({
    ScheduleRuleService: { getRules: jest.fn(), replaceRules: jest.fn() },
}))

import { getCurrentUser } from '@/lib/auth'
import { ScheduleRuleService } from '@/services/schedule-rule-service'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { GET, PUT } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedReplaceRules = ScheduleRuleService.replaceRules as jest.Mock

const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }
const staff: AccessTokenPayload = { userId: 5, role: 'staff', branchIds: [1] }
const rules = { keepApart: [[10, 11]], periodLimits: [] }

const put = (body: unknown) =>
    PUT(new NextRequest('http://localhost/api/schedule-rules', { method: 'PUT', body: JSON.stringify(body) }))

beforeEach(() => jest.resetAllMocks())

describe('GET /api/schedule-rules', () => {
    it('answers 401 with no session', async () => {
        mockedGetCurrentUser.mockReturnValue(null)

        expect((await GET(new NextRequest('http://localhost/api/schedule-rules?branchId=1'))).status).toBe(401)
    })

    it("refuses another branch's rules", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)

        expect((await GET(new NextRequest('http://localhost/api/schedule-rules?branchId=2'))).status).toBe(403)
        expect(ScheduleRuleService.getRules).not.toHaveBeenCalled()
    })
})

describe('PUT /api/schedule-rules', () => {
    it("saves the manager's own branch", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedReplaceRules.mockResolvedValue(rules)

        const res = await put({ branchId: 1, ...rules })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(rules)
    })

    it('refuses staff', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)

        expect((await put({ branchId: 1, ...rules })).status).toBe(403)
        expect(mockedReplaceRules).not.toHaveBeenCalled()
    })

    it('refuses a pair of one person before reaching the service', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)

        expect((await put({ branchId: 1, keepApart: [[10, 10]], periodLimits: [] })).status).toBe(400)
        expect(mockedReplaceRules).not.toHaveBeenCalled()
    })

    it('answers 400 for someone outside the branch', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedReplaceRules.mockRejectedValue(new UserNotAtBranchError())

        expect((await put({ branchId: 1, ...rules })).status).toBe(400)
    })
})
