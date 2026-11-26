import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/user-service'
import { UserUpdateSchema } from '@/types/user'
import { MANAGER_ROLE, OWNER_ROLE, requireCallerCanReachUser, requireSelfOrRole, requireUserUpdateAllowed } from '@/lib/rbac'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { InvalidRoleError } from '@/exceptions/invalid-role-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return invalidIdResponse('userId');
    }

    const caller = requireAuthenticated(req);

    if (caller instanceof NextResponse) {
        return caller;
    }

    try {
        requireSelfOrRole(caller, userId, [OWNER_ROLE, MANAGER_ROLE])

        const user = await UserService.getUserById(userId);

        if (!user) {
            return appErrorResponse(new UserNotFoundError(), 404);
        }

        await requireCallerCanReachUser(caller, userId)

        return NextResponse.json(user, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch user');
        return internalErrorResponse('Failed to fetch user');
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return invalidIdResponse('userId');
    }

    const caller = requireAuthenticated(req);

    if (caller instanceof NextResponse) {
        return caller;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return invalidJsonResponse()
    }

    const validationResult = UserUpdateSchema.safeParse(body);

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
    }

    try {
        requireUserUpdateAllowed(caller, userId, validationResult.data)

        const existing = await UserService.getUserById(userId);

        if (!existing) {
            return appErrorResponse(new UserNotFoundError(), 404);
        }

        await requireCallerCanReachUser(caller, userId)

        const user = await UserService.updateUser(userId, validationResult.data);
        return NextResponse.json(user, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserNotFoundError) {
            return appErrorResponse(error, 404)
        }
        if (error instanceof DuplicatePhoneError) {
            return appErrorResponse(error, 409)
        }
        if (error instanceof InvalidRoleError) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to update user')
        return internalErrorResponse('Failed to update user')
    }
}
