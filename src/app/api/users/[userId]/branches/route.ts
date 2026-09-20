import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { parseNumericId } from '@/lib/route-utils'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/branches'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    try {
        const branches = await UserBranchService.getBranchesByUser(userId);
        return NextResponse.json(branches, { status: 200 });
    } catch (error) {
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
    }
}
