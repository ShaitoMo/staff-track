import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'
import { MANAGER_ROLE, OWNER_ROLE, requireSelfOrRole } from '@/lib/rbac'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/branches'>
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

    try {
        requireSelfOrRole(user, userId, [OWNER_ROLE, MANAGER_ROLE])
        const branches = await UserBranchService.getBranchesByUser(userId);
        return NextResponse.json(branches, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to fetch branches');
        return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
    }
}
