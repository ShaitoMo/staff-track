import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/schedule-builder-service', () => ({ ScheduleBuilderService: { propose: jest.fn() } }))

import { getCurrentUser } from '@/lib/auth'
import { ScheduleBuilderService } from '@/services/schedule-builder-service'
import { SchedulerFailureCode, SchedulerUnavailableError } from '@/exceptions/scheduler-unavailable-error'
import { POST } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedPropose = ScheduleBuilderService.propose as jest.Mock

const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }

function post(body: unknown) {
    const req = new NextRequest('http://localhost/api/schedule-builder/propose', {
        method: 'POST',
        body: JSON.stringify(body),
    })
    return POST(req)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(manager)
})

describe('POST /api/schedule-builder/propose', () => {
    it.each<SchedulerFailureCode>(['SOLVER_NOT_CONFIGURED', 'SOLVER_UNAVAILABLE', 'SOLVER_CONTRACT_MISMATCH'])(
        'answers a solver failure with 503 %s',
        async (code) => {
            mockedPropose.mockRejectedValue(new SchedulerUnavailableError(code))

            const res = await post({ branchId: 1, weekStart: '2026-11-30' })

            expect(res.status).toBe(503)
            expect(await res.json()).toEqual({ error: 'Auto-fill service unavailable', code })
        },
    )
})
