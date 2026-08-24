import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { UserBranchNotFoundError } from '@/exceptions/user-branch-not-found-error'

export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/user-branches/[userId]/[branchId]'>
) {
    const { userId: userIdParam, branchId: branchIdParam } = await ctx.params;

    if (!/^\d+$/.test(userIdParam)) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    if (!/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, Number(branchIdParam))
        await UserBranchService.removeUserFromBranch(Number(userIdParam), Number(branchIdParam));
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof UserBranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to remove user from branch' }, { status: 500 })
    }
}
