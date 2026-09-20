import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'
import { UserBranchValidateSchema } from '@/types/user-branch'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { DuplicateUserBranchError } from '@/exceptions/duplicate-user-branch-error'
import { DuplicateMachineEmployeeIdError } from '@/exceptions/duplicate-machine-employee-id-error'
import { parseJsonBody, parseNumericId } from '@/lib/route-utils'

export async function GET(req: NextRequest) {
    const userIdParam = req.nextUrl.searchParams.get('userId');
    const branchIdParam = req.nextUrl.searchParams.get('branchId');

    const userId = userIdParam === null ? undefined : parseNumericId(userIdParam);

    if (userId === null) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const branchId = branchIdParam === null ? undefined : parseNumericId(branchIdParam);

    if (branchId === null) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    try {
        const userBranches = await UserBranchService.getUserBranches({ userId, branchId });
        return NextResponse.json(userBranches, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch user branches' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const parsed = await parseJsonBody(req, UserBranchValidateSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const userBranch = await UserBranchService.assignUserToBranch(parsed.data);
        return NextResponse.json(userBranch, { status: 201 })
    } catch (error) {
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        if (error instanceof DuplicateUserBranchError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        if (error instanceof DuplicateMachineEmployeeIdError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to assign user to branch' }, { status: 500 })
    }
}
