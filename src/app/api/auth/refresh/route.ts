import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/services/auth-service'
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, accessCookieOptions } from '@/lib/auth'
import { InvalidRefreshTokenError } from '@/exceptions/invalid-refresh-token-error'

/**
 * POST /api/auth/refresh — mints a new (short-lived) access token from the refresh cookie, reading
 * the caller's current role/branches/active state at the same time. This is the request that makes
 * a role change or deactivation take effect, not the access token's own expiry.
 */
export async function POST(req: NextRequest) {
    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value

    if (!refreshToken) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        const accessToken = await AuthService.refresh(refreshToken)

        const res = new NextResponse(null, { status: 204 })
        res.cookies.set(ACCESS_COOKIE_NAME, accessToken, accessCookieOptions)
        return res
    } catch (error) {
        if (error instanceof InvalidRefreshTokenError) {
            return NextResponse.json({ error: error.message }, { status: 401 })
        }
        console.error(error)
        return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 })
    }
}
