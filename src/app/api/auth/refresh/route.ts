import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/services/auth-service'
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, accessCookieOptions } from '@/lib/auth'
import { InvalidRefreshTokenError } from '@/exceptions/invalid-refresh-token-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, unauthenticatedResponse } from '@/lib/error-response'

/** POST /api/auth/refresh — mints a new access token from the refresh cookie, re-reading current role/branches/active state. */
export async function POST(req: NextRequest) {
    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value

    if (!refreshToken) {
        return unauthenticatedResponse()
    }

    try {
        const accessToken = await AuthService.refresh(refreshToken)

        const res = new NextResponse(null, { status: 204 })
        res.cookies.set(ACCESS_COOKIE_NAME, accessToken, accessCookieOptions)
        return res
    } catch (error) {
        if (error instanceof InvalidRefreshTokenError) {
            return appErrorResponse(error, 401)
        }
        logger.error({ err: error }, 'Failed to refresh session')
        return internalErrorResponse('Failed to refresh session')
    }
}
