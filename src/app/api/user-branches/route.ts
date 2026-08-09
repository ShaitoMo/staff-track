import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'

export async function GET(req: NextRequest) {
    const userIdParam = req.nextUrl.searchParams.get('user_id');
    const branchIdParam = req.nextUrl.searchParams.get('branch_id');

    if (userIdParam !== null && !/^\d+$/.test(userIdParam)) {
        return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 });
    }

    if (branchIdParam !== null && !/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branch_id' }, { status: 400 });
    }

    try {
        const userBranches = await UserBranchService.getUserBranches({
            userId: userIdParam === null ? undefined : Number(userIdParam),
            branchId: branchIdParam === null ? undefined : Number(branchIdParam),
        });
        return NextResponse.json(userBranches, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch user branches' }, { status: 500 });
    }
}
