import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the services and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({
    getCurrentUser: jest.fn(),
    ACCESS_COOKIE_NAME: 'stafftrack_access',
    REFRESH_COOKIE_NAME: 'stafftrack_refresh',
    accessCookieOptions: { path: '/' },
    refreshCookieOptions: { path: '/' },
}))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/user-service', () => ({
    UserService: { getUserById: jest.fn(), changeOwnPassword: jest.fn(), resetPassword: jest.fn() },
}))
jest.mock('@/services/user-branch-service', () => ({
    UserBranchService: { getBranchesByUser: jest.fn() },
}))
jest.mock('@/services/auth-service', () => ({
    AuthService: { startSession: jest.fn() },
}))

import { getCurrentUser } from '@/lib/auth'
import { UserService } from '@/services/user-service'
import { UserBranchService } from '@/services/user-branch-service'
import { AuthService } from '@/services/auth-service'
import { IncorrectPasswordError } from '@/exceptions/incorrect-password-error'
import { isLoginLocked, recordFailedLogin } from '@/lib/login-rate-limit'
import { PUT } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedGetUser = UserService.getUserById as jest.Mock
const mockedChange = UserService.changeOwnPassword as jest.Mock
const mockedReset = UserService.resetPassword as jest.Mock
const mockedBranches = UserBranchService.getBranchesByUser as jest.Mock
const mockedStartSession = AuthService.startSession as jest.Mock

const staff: AccessTokenPayload = { userId: 5, role: 'cashier', branchIds: [1] }
const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [1] }

let phoneSeq = 0

function call(targetUserId: number, body: unknown) {
    const req = new NextRequest(`http://localhost/api/users/${targetUserId}/password`, {
        method: 'PUT',
        body: JSON.stringify(body),
    })
    const ctx = { params: Promise.resolve({ userId: String(targetUserId) }) }
    return PUT(req, ctx as never)
}

beforeEach(() => {
    jest.resetAllMocks()
    // the login limiter is in-memory and keyed by phone, so each test gets its own phone
    phoneSeq += 1
    mockedGetUser.mockResolvedValue({ userId: 5, phone: `7110${phoneSeq}`, isActive: true })
    mockedStartSession.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' })
})

describe('PUT /api/users/:userId/password: Change password (own)', () => {
    it('requires the current password', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)

        const res = await call(5, { password: 'new-secret' })

        expect(res.status).toBe(400)
        expect(mockedChange).not.toHaveBeenCalled()
    })

    it('answers a wrong current password with 400, not 401, so the user stays signed in', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)
        mockedChange.mockRejectedValue(new IncorrectPasswordError())

        const res = await call(5, { currentPassword: 'guess', password: 'new-secret' })

        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({
            error: 'Current password is incorrect',
            code: 'INCORRECT_PASSWORD',
            fields: [{ path: 'currentPassword', code: 'INCORRECT_PASSWORD' }],
        })
    })

    it('locks out after repeated wrong current passwords, like login', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)
        mockedChange.mockRejectedValue(new IncorrectPasswordError())

        for (let attempt = 0; attempt < 5; attempt += 1) {
            await call(5, { currentPassword: 'guess', password: 'new-secret' })
        }
        const res = await call(5, { currentPassword: 'old-secret', password: 'new-secret' })

        expect(res.status).toBe(429)
        expect(mockedChange).toHaveBeenCalledTimes(5)
    })

    it('keeps this device signed in with fresh cookies', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)

        const res = await call(5, { currentPassword: 'old-secret', password: 'new-secret' })

        expect(res.status).toBe(204)
        expect(mockedChange).toHaveBeenCalledWith(5, 'old-secret', 'new-secret')
        expect(res.cookies.get('stafftrack_access')?.value).toBe('new-access')
        expect(res.cookies.get('stafftrack_refresh')?.value).toBe('new-refresh')
    })
})

describe('PUT /api/users/:userId/password: lockout and closed accounts', () => {
    it('lets no more than 5 guesses through when they arrive all at once', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)
        mockedChange.mockRejectedValue(new IncorrectPasswordError())

        const responses = await Promise.all(
            Array.from({ length: 20 }, (_, i) => call(5, { currentPassword: `guess-${i}`, password: 'new-secret' })),
        )

        expect(mockedChange.mock.calls.length).toBeLessThanOrEqual(5)
        expect(responses.filter((res) => res.status === 429).length).toBeGreaterThanOrEqual(15)
    })

    it('refuses a deactivated account before changing anything', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)
        mockedGetUser.mockResolvedValue({ userId: 5, phone: `7110${phoneSeq}`, isActive: false })

        const res = await call(5, { currentPassword: 'old-secret', password: 'new-secret' })

        expect(res.status).toBe(401)
        expect(mockedChange).not.toHaveBeenCalled()
    })

    it("lifts the user's login lockout when a manager resets their password", async () => {
        const phone = `7110${phoneSeq}`
        for (let attempt = 0; attempt < 5; attempt += 1) recordFailedLogin(phone)
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedBranches.mockResolvedValue([{ branchId: 1 }])

        const res = await call(5, { password: 'temp-pass' })

        expect(res.status).toBe(204)
        expect(isLoginLocked(phone)).toBe(false)
    })
})

describe('PUT /api/users/:userId/password: Change password, account closed mid-change', () => {
    it('answers 401, not 500, when the account can no longer sign in', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)
        mockedStartSession.mockResolvedValue(null)

        const res = await call(5, { currentPassword: 'old-secret', password: 'new-secret' })

        expect(res.status).toBe(401)
        expect(res.cookies.get('stafftrack_access')).toBeUndefined()
    })
})

describe('PUT /api/users/:userId/password: Reset password (someone else)', () => {
    it("lets a manager reset a user at their branch without the old password, and leaves the manager's cookies alone", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedBranches.mockResolvedValue([{ branchId: 1 }])

        const res = await call(5, { password: 'temp-pass' })

        expect(res.status).toBe(204)
        expect(mockedReset).toHaveBeenCalledWith(5, 'temp-pass')
        expect(mockedStartSession).not.toHaveBeenCalled()
        expect(res.cookies.get('stafftrack_access')).toBeUndefined()
    })

    it('refuses a manager resetting a user at another branch', async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedBranches.mockResolvedValue([{ branchId: 2 }])

        const res = await call(5, { password: 'temp-pass' })

        expect(res.status).toBe(403)
        expect(mockedReset).not.toHaveBeenCalled()
    })

    it('refuses staff resetting someone else', async () => {
        mockedGetCurrentUser.mockReturnValue(staff)

        const res = await call(6, { password: 'temp-pass' })

        expect(res.status).toBe(403)
        expect(mockedReset).not.toHaveBeenCalled()
    })
})
