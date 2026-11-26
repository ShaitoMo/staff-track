import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/services/auth-service'
import { UserService } from '@/services/user-service'
import { LoginSchema } from '@/types/auth'
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, accessCookieOptions, refreshCookieOptions } from '@/lib/auth'
import { InvalidCredentialsError } from '@/exceptions/invalid-credentials-error'
import { clearLoginAttempts, isLoginLocked, recordFailedLogin } from '@/lib/login-rate-limit'
import { logger } from '@/lib/logger'
import { appErrorResponse, errorResponse, internalErrorResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

/** POST /api/auth/login — verifies phone + password, sets the access and refresh cookies. */
export async function POST(req: NextRequest) {
    let body
    try {
        body = await req.json()
    } catch {
        return invalidJsonResponse()
    }

    const validationResult = LoginSchema.safeParse(body)

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
    }

    const { phone } = validationResult.data

    if (isLoginLocked(phone)) {
        return errorResponse(429, 'TOO_MANY_ATTEMPTS', 'Too many failed login attempts. Try again later.')
    }

    try {
        const { accessToken, refreshToken, userId } = await AuthService.login(validationResult.data)
        clearLoginAttempts(phone)
        const user = await UserService.getUserById(userId)

        const res = NextResponse.json(user, { status: 200 })
        res.cookies.set(ACCESS_COOKIE_NAME, accessToken, accessCookieOptions)
        res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions)
        return res
    } catch (error) {
        if (error instanceof InvalidCredentialsError) {
            recordFailedLogin(phone)
            return appErrorResponse(error, 401)
        }
        logger.error({ err: error }, 'Failed to log in')
        return internalErrorResponse('Failed to log in')
    }
}
