import { NextRequest } from 'next/server'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({
    ACCESS_COOKIE_NAME: 'stafftrack_access',
    REFRESH_COOKIE_NAME: 'stafftrack_refresh',
    AUTH_HEADER_USER_ID: 'x-auth-user-id',
    AUTH_HEADER_ROLE: 'x-auth-role',
    AUTH_HEADER_BRANCH_IDS: 'x-auth-branch-ids',
    accessCookieOptions: {},
    verifyAccessToken: jest.fn(),
}))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/auth-service', () => ({ AuthService: { refresh: jest.fn() } }))

import { verifyAccessToken } from '@/lib/auth'
import { AuthService } from '@/services/auth-service'
import { InvalidRefreshTokenError } from '@/exceptions/invalid-refresh-token-error'
import { proxy } from './proxy'

const mockedVerify = verifyAccessToken as jest.Mock
const mockedRefresh = AuthService.refresh as jest.Mock

/** A request whose access cookie has lapsed, leaving only the refresh cookie. */
function expiredSession(path: string) {
    return new NextRequest(`http://localhost${path}`, {
        headers: { cookie: 'stafftrack_refresh=refresh-token' },
    })
}

beforeEach(() => {
    jest.resetAllMocks()
})

describe('proxy — refreshing an expired session', () => {
    it('sends a page request to /login, carrying the page and its query as next', async () => {
        mockedRefresh.mockRejectedValue(new InvalidRefreshTokenError())

        const res = await proxy(expiredSession('/tasks?branch=2&week=2026-11-23'))

        expect(res.status).toBe(307)
        const location = new URL(res.headers.get('location')!)
        expect(location.pathname).toBe('/login')
        expect(location.searchParams.get('next')).toBe('/tasks?branch=2&week=2026-11-23')
    })

    it('answers 503, not a logout, when the refresh fails for another reason', async () => {
        mockedRefresh.mockRejectedValue(new Error('connection reset'))

        const page = await proxy(expiredSession('/tasks'))
        const api = await proxy(expiredSession('/api/tasks'))

        expect(page.status).toBe(503)
        expect(api.status).toBe(503)
        expect(await api.json()).toMatchObject({ code: 'SESSION_REFRESH_UNAVAILABLE' })
        // the refresh cookie is left alone, so the next request can try again
        expect(page.headers.get('set-cookie')).toBeNull()
    })

    it('answers an API request with UNAUTHENTICATED when the refresh token is invalid', async () => {
        mockedRefresh.mockRejectedValue(new InvalidRefreshTokenError())

        const res = await proxy(expiredSession('/api/tasks'))

        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: 'Not authenticated', code: 'UNAUTHENTICATED' })
    })

    it('lets the request through with a fresh access cookie when the refresh succeeds', async () => {
        mockedRefresh.mockResolvedValue('new-access-token')
        mockedVerify.mockResolvedValue({ userId: 5, role: 'staff', branchIds: [1] })

        const res = await proxy(expiredSession('/tasks'))

        expect(res.status).toBe(200)
        expect(res.cookies.get('stafftrack_access')?.value).toBe('new-access-token')
    })
})
