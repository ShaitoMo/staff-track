import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/services/auth-service'
import { UserService } from '@/services/user-service'
import { LoginSchema } from '@/types/auth'
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, accessCookieOptions, refreshCookieOptions } from '@/lib/auth'
import { InvalidCredentialsError } from '@/exceptions/invalid-credentials-error'
import { logger } from '@/lib/logger'

/** POST /api/auth/login — verifies phone + password, sets the access and refresh cookies. */
export async function POST(req: NextRequest) {
    let body
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = LoginSchema.safeParse(body)

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const { accessToken, refreshToken, userId } = await AuthService.login(validationResult.data)
        const user = await UserService.getUserById(userId)

        const res = NextResponse.json(user, { status: 200 })
        res.cookies.set(ACCESS_COOKIE_NAME, accessToken, accessCookieOptions)
        res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions)
        return res
    } catch (error) {
        if (error instanceof InvalidCredentialsError) {
            return NextResponse.json({ error: error.message }, { status: 401 })
        }
        logger.error({ err: error }, 'Failed to log in');
        return NextResponse.json({ error: 'Failed to log in' }, { status: 500 })
    }
}
