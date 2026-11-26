import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/attendance-service', () => ({ AttendanceService: { createAttendance: jest.fn() } }))

import { getCurrentUser } from '@/lib/auth'
import { AttendanceService } from '@/services/attendance-service'
import { POST } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedCreateAttendance = AttendanceService.createAttendance as jest.Mock

const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }

function post(body: unknown) {
    const req = new NextRequest('http://localhost/api/attendance', { method: 'POST', body: JSON.stringify(body) })
    return POST(req)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(manager)
})

describe('POST /api/attendance', () => {
    it('answers a clock-out before the clock-in with 400 END_BEFORE_START on clock_out', async () => {
        const res = await post({
            user_id: 5,
            branch_id: 1,
            clock_in: '2026-11-26T15:00:00.000Z',
            clock_out: '2026-11-26T07:00:00.000Z',
        })

        expect(res.status).toBe(400)
        expect(await res.json()).toMatchObject({
            code: 'VALIDATION_FAILED',
            fields: [{ path: 'clock_out', code: 'END_BEFORE_START' }],
        })
        expect(mockedCreateAttendance).not.toHaveBeenCalled()
    })
})
