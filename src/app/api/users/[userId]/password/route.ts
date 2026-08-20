import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/user-service'
import { UpdatePasswordSchema } from '@/types/user'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireSelfOrRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { parseNumericId, zodErrorResponse } from '@/lib/route-utils'

export async function PUT(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/password'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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

    try {
        requireSelfOrRole(user, userId, [OWNER_ROLE, MANAGER_ROLE])
        await UserService.updatePassword(userId, validationResult.data.password);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }
}
