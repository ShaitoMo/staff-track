import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { UserBranchNotFoundError } from '@/exceptions/user-branch-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse } from '@/lib/error-response'

export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/user-branches/[userId]/[branchId]'>
) {
    const { userId: userIdParam, branchId: branchIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return invalidIdResponse('userId');
    }

    const branchId = parseNumericId(branchIdParam);

    if (branchId === null) {
        return invalidIdResponse('branchId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, branchId)
        await UserBranchService.removeUserFromBranch(userId, branchId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserBranchNotFoundError) {
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to remove user from branch')
        return internalErrorResponse('Failed to remove user from branch')
    }
}
