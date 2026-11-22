import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/user-service'
import { UserBranchService } from '@/services/user-branch-service'
import { AuthService } from '@/services/auth-service'
import { UpdatePasswordSchema } from '@/types/user'
import { AccessTokenPayload } from '@/types/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireAnyBranchAccess, requireRole } from '@/lib/rbac'
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, accessCookieOptions, refreshCookieOptions } from '@/lib/auth'
import { clearLoginAttempts, isLoginLocked, recordFailedLogin } from '@/lib/login-rate-limit'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { IncorrectPasswordError } from '@/exceptions/incorrect-password-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId, zodErrorResponse } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

/**
 * PUT /api/users/:userId/password — Change password when it's your own (current password required,
 * this device gets fresh cookies), Reset password when it's someone else's (owner, or a manager
 * sharing one of their branches). Either way every other session is signed out (ADR 0001).
 */
export async function PUT(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/password'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = UpdatePasswordSchema.safeParse(body);

    if (!validationResult.success) {
        return zodErrorResponse(validationResult.error)
    }

    const { password, currentPassword } = validationResult.data

    try {
        if (user.userId === userId) {
            return await changeOwnPassword(userId, currentPassword, password)
        }

        await requireCanReset(user, userId)
        await UserService.resetPassword(userId, password);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to update password')
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }
}

/** Someone else's password: owner, or a manager sharing one of the target's branches (the owner has none, so stays out of reach). */
async function requireCanReset(caller: AccessTokenPayload, targetUserId: number): Promise<void> {
    requireRole(caller, [OWNER_ROLE, MANAGER_ROLE])
    const targetBranches = await UserBranchService.getBranchesByUser(targetUserId)
    requireAnyBranchAccess(caller, targetBranches.map((branch) => branch.branchId))
}

/** Wrong guesses share the login lockout (keyed by phone), so a borrowed signed-in phone can't brute-force it here instead. */
async function changeOwnPassword(userId: number, currentPassword: string | undefined, password: string): Promise<NextResponse> {
    if (currentPassword === undefined) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
    }

    const self = await UserService.getUserById(userId)

    if (!self) {
        throw new UserNotFoundError()
    }

    if (isLoginLocked(self.phone)) {
        return NextResponse.json({ error: 'Too many failed attempts. Try again later.' }, { status: 429 })
    }

    try {
        await UserService.changeOwnPassword(userId, currentPassword, password)
    } catch (error) {
        if (error instanceof IncorrectPasswordError) {
            recordFailedLogin(self.phone)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        throw error
    }

    clearLoginAttempts(self.phone)
    const session = await AuthService.startSession(userId)

    // deactivated between the check and now: the password changed, but they can't sign in any more
    if (session === null) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const res = new NextResponse(null, { status: 204 })
    res.cookies.set(ACCESS_COOKIE_NAME, session.accessToken, accessCookieOptions)
    res.cookies.set(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions)
    return res
}
