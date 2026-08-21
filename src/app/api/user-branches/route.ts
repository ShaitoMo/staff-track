import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'
import { UserBranchValidateSchema } from '@/types/user-branch'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { DuplicateUserBranchError } from '@/exceptions/duplicate-user-branch-error'
import { DuplicateMachineEmployeeIdError } from '@/exceptions/duplicate-machine-employee-id-error'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
    const userIdParam = req.nextUrl.searchParams.get('user_id');
    const branchIdParam = req.nextUrl.searchParams.get('branch_id');

    if (userIdParam !== null && !/^\d+$/.test(userIdParam)) {
        return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 });
    }

    if (branchIdParam !== null && !/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branch_id' }, { status: 400 });
    }

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])

        if (branchIdParam !== null) {
            requireBranchAccess(user, Number(branchIdParam))
        }

        const userBranches = await UserBranchService.getUserBranches({
            userId: userIdParam === null ? undefined : Number(userIdParam),
            branchId: branchIdParam === null ? undefined : Number(branchIdParam),
        });

        // No branch_id filter given: a manager still only sees links within their own branches.
        const visible = user.role === OWNER_ROLE
            ? userBranches
            : userBranches.filter((link) => user.branchIds.includes(link.branchId))

        return NextResponse.json(visible, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        logger.error({ err: error }, 'Failed to fetch user branches');
        return NextResponse.json({ error: 'Failed to fetch user branches' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

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
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, validationResult.data.branchId)
        const userBranch = await UserBranchService.assignUserToBranch(validationResult.data);
        return NextResponse.json(userBranch, { status: 201 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
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
        logger.error({ err: error }, 'Failed to assign user to branch');
        return NextResponse.json({ error: 'Failed to assign user to branch' }, { status: 500 })
    }
}
