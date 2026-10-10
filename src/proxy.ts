import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
    ACCESS_COOKIE_NAME,
    AUTH_HEADER_BRANCH_IDS,
    AUTH_HEADER_ROLE,
    AUTH_HEADER_USER_ID,
    REFRESH_COOKIE_NAME,
    accessCookieOptions,
    verifyAccessToken,
} from '@/lib/auth'
import { AuthService } from '@/services/auth-service'
import { InvalidRefreshTokenError } from '@/exceptions/invalid-refresh-token-error'
import { logger } from '@/lib/logger'

/** Reachable without a session — login/refresh can't require what they grant, logout must survive an expired token, and /login is where an unauthenticated page request gets sent. */
const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/login'])

/**
 * Authenticates every request except static assets, on the Node.js runtime Proxy defaults to since Next 16.
 * Header stripping runs before the public-path check, not inside it, so a public route that later
 * reads identity sees 'nobody' rather than forged headers, with no sanitizing of its own required.
 * On success, page Server Components read the stamped x-auth-* headers directly via next/headers
 * instead of calling back into /api/auth/me.
 */
export async function proxy(request: NextRequest) {
    const headers = new Headers(request.headers)
    headers.delete(AUTH_HEADER_USER_ID)
    headers.delete(AUTH_HEADER_ROLE)
    headers.delete(AUTH_HEADER_BRANCH_IDS)

    if (PUBLIC_PATHS.has(request.nextUrl.pathname)) {
        return NextResponse.next({ request: { headers } })
    }

    const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value
    let user = token ? await verifyAccessToken(token) : null
    let refreshedToken: string | null = null

    if (!user) {
        try {
            refreshedToken = await tryRefresh(request)
        } catch {
            return refreshUnavailable(request)
        }
        user = refreshedToken ? await verifyAccessToken(refreshedToken) : null
    }

    if (!user) {
        if (request.nextUrl.pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }
        return NextResponse.redirect(new URL('/login', request.url))
    }

    headers.set(AUTH_HEADER_USER_ID, String(user.userId))
    headers.set(AUTH_HEADER_ROLE, user.role)
    headers.set(AUTH_HEADER_BRANCH_IDS, JSON.stringify(user.branchIds))

    if (!refreshedToken) {
        return NextResponse.next({ request: { headers } })
    }

    // Forward the fresh token too, so a Server Component's fetchApi (which re-sends cookies()) doesn't refresh again.
    request.cookies.set(ACCESS_COOKIE_NAME, refreshedToken)
    headers.set('cookie', request.cookies.toString())

    const res = NextResponse.next({ request: { headers } })
    res.cookies.set(ACCESS_COOKIE_NAME, refreshedToken, accessCookieOptions)
    return res
}

/**
 * Mints a new access token from the refresh cookie once the short-lived access cookie has lapsed.
 * Null means log in again; any other failure (a DB blip) is rethrown, since the refresh token may
 * still be good and sending the user to /login would throw away a valid session.
 */
async function tryRefresh(request: NextRequest): Promise<string | null> {
    const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value

    if (!refreshToken) {
        return null
    }

    try {
        return await AuthService.refresh(refreshToken)
    } catch (error) {
        if (error instanceof InvalidRefreshTokenError) {
            return null
        }
        logger.error({ err: error }, 'Failed to refresh session in proxy')
        throw error
    }
}

/** A temporary 503 that leaves both cookies alone, so the next request simply tries the refresh again. */
function refreshUnavailable(request: NextRequest): NextResponse {
    const message = 'Service temporarily unavailable, please try again'

    if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: message }, { status: 503 })
    }
    return new NextResponse(message, { status: 503 })
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
