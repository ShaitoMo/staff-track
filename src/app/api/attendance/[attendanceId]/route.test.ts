import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/attendance-service', () => ({
    AttendanceService: { getAttendanceById: jest.fn(), updateAttendance: jest.fn() },
}))

import { getCurrentUser } from '@/lib/auth'
import { AttendanceService } from '@/services/attendance-service'
import { InvalidAttendanceTimesError } from '@/exceptions/invalid-attendance-times-error'
import { PATCH } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedGetAttendanceById = AttendanceService.getAttendanceById as jest.Mock
const mockedUpdateAttendance = AttendanceService.updateAttendance as jest.Mock

const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }

function patch(body: unknown) {
    const req = new NextRequest('http://localhost/api/attendance/9', { method: 'PATCH', body: JSON.stringify(body) })
    return PATCH(req, { params: Promise.resolve({ attendanceId: '9' }) } as never)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(manager)
})

describe('PATCH /api/attendance/:id', () => {
    it('answers a merged punch ending before it starts with 422 INVALID_ATTENDANCE_TIMES on clock_out', async () => {
        mockedGetAttendanceById.mockResolvedValue({ attendance_id: 9, branch_id: 1 })
        mockedUpdateAttendance.mockRejectedValue(new InvalidAttendanceTimesError())

        const res = await patch({ clock_out: '2026-11-26T06:00:00.000Z' })

        expect(res.status).toBe(422)
        expect(await res.json()).toEqual({
            error: 'clock_out must be after clock_in',
            code: 'INVALID_ATTENDANCE_TIMES',
            fields: [{ path: 'clock_out', code: 'INVALID_ATTENDANCE_TIMES' }],
        })
    })
})
