import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/user-service'
import { UserBranchService } from '@/services/user-branch-service'
import { UpdatePasswordSchema } from '@/types/user'
import { MANAGER_ROLE, OWNER_ROLE, requireSelfOrRole, requireSharedBranchWithUser } from '@/lib/rbac'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId, zodErrorResponse } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

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

    try {
        requireSelfOrRole(user, userId, [OWNER_ROLE, MANAGER_ROLE])

        if (user.userId !== userId) {
            const targetBranches = await UserBranchService.getBranchesByUser(userId)
            requireSharedBranchWithUser(user, targetBranches.map((branch) => branch.branchId))
        }

        await UserService.updatePassword(userId, validationResult.data.password);
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
