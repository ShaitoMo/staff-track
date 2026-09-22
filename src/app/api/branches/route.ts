import { NextRequest, NextResponse } from 'next/server'
import { BranchService } from '@/services/branch-service'
import { CreateBranchSchema } from '@/types/branch'
import { requireAuthenticated, forbiddenResponse, parseJsonBody } from '@/lib/route-utils'
import { MANAGER_ROLE, OWNER_ROLE, requireRole } from '@/lib/rbac'

/** Owner sees every branch; a manager only their own (FR10). Staff have no branch-management view. */
export async function GET(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        const branches = await BranchService.getAllBranches();
        const visible = user.role === OWNER_ROLE
            ? branches
            : branches.filter((branch) => user.branchIds.includes(branch.branchId))
        return NextResponse.json(visible, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
    }
}

/** Creating a new branch is chain-wide, not scoped to any existing one — owner only. */
export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
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
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 })
    }
}
