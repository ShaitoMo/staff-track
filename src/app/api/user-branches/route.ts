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

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])

        if (branchId !== undefined) {
            requireBranchAccess(user, branchId)
        }

        const userBranches = await UserBranchService.getUserBranches({ userId, branchId });

        // No branch_id filter given: a manager still only sees links within their own branches.
        const visible = user.role === OWNER_ROLE
            ? userBranches
            : userBranches.filter((link) => user.branchIds.includes(link.branchId))

        return NextResponse.json(visible, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch user branches' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const parsed = await parseJsonBody(req, UserBranchValidateSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, parsed.data.branchId)
        const userBranch = await UserBranchService.assignUserToBranch(parsed.data);
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
        console.error(error);
        return NextResponse.json({ error: 'Failed to assign user to branch' }, { status: 500 })
    }
}
