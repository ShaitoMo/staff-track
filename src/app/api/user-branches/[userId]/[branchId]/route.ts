import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'
import { UserBranchNotFoundError } from '@/exceptions/user-branch-not-found-error'

export async function DELETE(
    _req: NextRequest,
    ctx: RouteContext<'/api/user-branches/[userId]/[branchId]'>
) {
    const { userId: userIdParam, branchId: branchIdParam } = await ctx.params;

    if (!/^\d+$/.test(userIdParam)) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    if (!/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    try {
        await UserBranchService.removeUserFromBranch(Number(userIdParam), Number(branchIdParam));
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof UserBranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to remove user from branch' }, { status: 500 })
    }
}
