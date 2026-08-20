import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/user-service'
import { UserUpdateSchema } from '@/types/user'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireRole, requireSelfOrRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { InvalidRoleError } from '@/exceptions/invalid-role-error'
import { parseNumericId, zodErrorResponse } from '@/lib/route-utils'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const caller = getCurrentUser(req)

    if (!caller) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireSelfOrRole(caller, userId, [OWNER_ROLE, MANAGER_ROLE])

        const user = await UserService.getUserById(userId);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        console.error(error);
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

    const caller = getCurrentUser(req)

    if (!caller) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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
        const user = await UserService.updateUser(userId, validationResult.data);
        return NextResponse.json(user, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
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
        console.error(error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }
}
