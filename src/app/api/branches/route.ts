import { NextRequest, NextResponse } from 'next/server'
import { BranchService } from '@/services/branch-service'
import { CreateBranchSchema } from '@/types/branch'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { logger } from '@/lib/logger'

/** Owner sees every branch; a manager only their own (FR10). Staff have no branch-management view. */
export async function GET(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        const branches = await BranchService.getAllBranches();
        const visible = user.role === OWNER_ROLE
            ? branches
            : branches.filter((branch) => user.branchIds.includes(branch.branchId))
        return NextResponse.json(visible, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        logger.error({ err: error }, 'Failed to fetch branches');
        return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
    }
}

/** Creating a new branch is chain-wide, not scoped to any existing one — owner only. */
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
    const { name, location } = body;

    const validationResult = CreateBranchSchema.safeParse({ name, location });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        requireRole(user, [OWNER_ROLE])
        const branch = await BranchService.createBranch(validationResult.data);
        return NextResponse.json(branch, { status: 201 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        logger.error({ err: error }, 'Failed to create branch');
        return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 })
    }
}