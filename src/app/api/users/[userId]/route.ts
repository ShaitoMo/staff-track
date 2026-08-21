import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/user-service'
import { UserBranchService } from '@/services/user-branch-service'
import { UserUpdateSchema } from '@/types/user'
import { MANAGER_ROLE, OWNER_ROLE, requireRole, requireSelfOrRole, requireSharedBranchWithUser } from '@/lib/rbac'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { InvalidRoleError } from '@/exceptions/invalid-role-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId, zodErrorResponse } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const caller = requireAuthenticated(req);

    if (caller instanceof NextResponse) {
        return caller;
    }

    try {
        requireSelfOrRole(caller, userId, [OWNER_ROLE, MANAGER_ROLE])

        const user = await UserService.getUserById(userId);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch user');
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const caller = requireAuthenticated(req);

    if (caller instanceof NextResponse) {
        return caller;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = UserUpdateSchema.safeParse(body);

    if (!validationResult.success) {
        return zodErrorResponse(validationResult.error)
    }

    try {
        requireRole(caller, [OWNER_ROLE, MANAGER_ROLE])

        if (validationResult.data.roleId !== undefined) {
            requireRole(caller, [OWNER_ROLE])
        }

        const targetBranches = await UserBranchService.getBranchesByUser(userId)
        requireSharedBranchWithUser(caller, targetBranches.map((branch) => branch.branchId))

        const user = await UserService.updateUser(userId, validationResult.data);
        return NextResponse.json(user, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof DuplicatePhoneError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        if (error instanceof InvalidRoleError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to update user');
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }
}
