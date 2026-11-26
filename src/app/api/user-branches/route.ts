import { NextRequest, NextResponse } from 'next/server'
import { UserBranchService } from '@/services/user-branch-service'
import { UserBranchValidateSchema } from '@/types/user-branch'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { DuplicateUserBranchError } from '@/exceptions/duplicate-user-branch-error'
import { DuplicateMachineEmployeeIdError } from '@/exceptions/duplicate-machine-employee-id-error'
import { requireAuthenticated, forbiddenResponse, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse } from '@/lib/error-response'

export async function GET(req: NextRequest) {
    const userIdParam = req.nextUrl.searchParams.get('userId');
    const branchIdParam = req.nextUrl.searchParams.get('branchId');

    const userId = userIdParam === null ? undefined : parseNumericId(userIdParam);

    if (userId === null) {
        return invalidIdResponse('userId');
    }

    const branchId = branchIdParam === null ? undefined : parseNumericId(branchIdParam);

    if (branchId === null) {
        return invalidIdResponse('branchId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
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
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch user branches');
        return internalErrorResponse('Failed to fetch user branches');
    }
}

export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
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
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserNotFoundError) {
            return appErrorResponse(error, 400)
        }
        if (error instanceof BranchNotFoundError) {
            return appErrorResponse(error, 400)
        }
        if (error instanceof DuplicateUserBranchError) {
            return appErrorResponse(error, 409)
        }
        if (error instanceof DuplicateMachineEmployeeIdError) {
            return appErrorResponse(error, 409)
        }
        logger.error({ err: error }, 'Failed to assign user to branch')
        return internalErrorResponse('Failed to assign user to branch')
    }
}
