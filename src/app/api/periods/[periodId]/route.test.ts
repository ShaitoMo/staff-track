import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'
import { ShiftPeriodView } from '@/types/shift-period'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/period-service', () => ({
    PeriodService: { getPeriodView: jest.fn() },
}))

import { getCurrentUser } from '@/lib/auth'
import { PeriodService } from '@/services/period-service'
import { GET } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedGetPeriodView = PeriodService.getPeriodView as jest.Mock

const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }
const staff: AccessTokenPayload = { userId: 5, role: 'staff', branchIds: [1] }

const period = (branchId: number | null): ShiftPeriodView => ({
    periodId: 3,
    branchId,
    name: 'Morning',
    defaultStart: '07:00',
    defaultEnd: '15:00',
    sortOrder: 1,
    active: true,
})

function call(periodId: string) {
    const req = new NextRequest(`http://localhost/api/periods/${periodId}`)
    return GET(req, { params: Promise.resolve({ periodId }) } as never)
}

beforeEach(() => {
    jest.resetAllMocks()
})

describe('GET /api/periods/:id', () => {
    it("returns a period at the manager's own branch", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetPeriodView.mockResolvedValue(period(1))

        const res = await call('3')

        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ periodId: 3, active: true })
    })

    it('lets a manager read a chain-wide period, as the list does', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetPeriodView.mockResolvedValue(period(null))

        expect((await call('3')).status).toBe(200)
    })

    it("refuses a period at a branch the manager doesn't have", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetPeriodView.mockResolvedValue(period(2))

        expect((await call('3')).status).toBe(403)
    })

    it('refuses staff before looking the period up', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)

        expect((await call('3')).status).toBe(403)
        expect(mockedGetPeriodView).not.toHaveBeenCalled()
    })

    it('answers 404 for a missing period and 400 for a malformed id', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetPeriodView.mockResolvedValue(null)

        expect((await call('3')).status).toBe(404)
        expect((await call('abc')).status).toBe(400)
    })
})
