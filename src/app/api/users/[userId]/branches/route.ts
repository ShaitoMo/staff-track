import { NextRequest, NextResponse } from 'next/server'
import { BranchService } from '@/services/branch-service'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/branches'>
) {
    const { userId: userIdParam } = await ctx.params;

    if (!/^\d+$/.test(userIdParam)) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const userId = Number(userIdParam);

    try {
        const branches = await BranchService.getBranchesByUser(userId);
        return NextResponse.json(branches, { status: 200 });
    } catch (error) {
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
    }
}
