import { NextRequest, NextResponse } from 'next/server'
import { UserValidateSchema } from '@/types/user'
import { UserService } from '@/services/user-service'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { InvalidRoleError } from '@/exceptions/invalid-role-error'
import { requireAuthenticated, forbiddenResponse, zodErrorResponse } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
    const caller = requireAuthenticated(req);

    if (caller instanceof NextResponse) {
        return caller;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = UserValidateSchema.safeParse(body);

    if (!validationResult.success) {
        return zodErrorResponse(validationResult.error)
    }

    try {
        requireRole(caller, [OWNER_ROLE])
        const user = await UserService.createUser(validationResult.data);
        return NextResponse.json(user, { status: 201 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof DuplicatePhoneError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (error instanceof InvalidRoleError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to create user')
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }
}
/**
 * Owner sees every user; a manager only those assigned to at least one of their own branches.
 * An optional `branch_id` narrows to one branch — owner may pass any, a manager only their own.
 */
export async function GET(req: NextRequest) {
    const caller = requireAuthenticated(req);

    if (caller instanceof NextResponse) {
        return caller;
    }

    const branchIdParam = req.nextUrl.searchParams.get('branch_id')

    if (branchIdParam !== null && !/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branch_id' }, { status: 400 })
    }

    try {
        requireRole(caller, [OWNER_ROLE, MANAGER_ROLE])

        let branchIds: number[] | undefined
        if (branchIdParam !== null) {
            const branchId = Number(branchIdParam)
            requireBranchAccess(caller, branchId)
            branchIds = [branchId]
        } else {
            branchIds = caller.role === OWNER_ROLE ? undefined : caller.branchIds
        }

        const users = await UserService.getAllUsers(branchIds);
        return NextResponse.json(users, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch users');
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}
