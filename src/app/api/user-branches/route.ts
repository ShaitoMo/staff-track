import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'
import { UserBranchValidateSchema } from '@/types/user-branch'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { DuplicateUserBranchError } from '@/exceptions/duplicate-user-branch-error'
import { DuplicateMachineEmployeeIdError } from '@/exceptions/duplicate-machine-employee-id-error'

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

export async function POST(req: NextRequest) {
    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { userId, branchId, machineEmployeeId } = body;

    const validationResult = UserBranchValidateSchema.safeParse({ userId, branchId, machineEmployeeId });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const userBranch = await UserBranchService.assignUserToBranch(validationResult.data);
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
