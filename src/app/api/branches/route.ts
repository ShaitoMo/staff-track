import { NextRequest, NextResponse } from 'next/server'
import { BranchService } from '@/services/branch-service'
import { CreateBranchSchema } from '@/types/branch'
import { parseJsonBody } from '@/lib/route-utils'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'

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
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
    }
}

/** Creating a new branch is chain-wide, not scoped to any existing one — owner only. */
export async function POST(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const parsed = await parseJsonBody(req, CreateBranchSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE])
        const branch = await BranchService.createBranch(parsed.data);
        return NextResponse.json(branch, { status: 201 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 })
    }
}
