import { NextRequest, NextResponse } from 'next/server'
import { BranchService } from '@/services/branch-service'
import { BranchUpdateSchema } from '@/types/branch'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseJsonBody, parseNumericId } from '@/lib/route-utils'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]'>
) {
    const { branchId: branchIdParam } = await ctx.params;

    const branchId = parseNumericId(branchIdParam);

    if (branchId === null) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE]);
        requireBranchAccess(user, branchId);

        const branch = await BranchService.getBranchById(branchId);

        if (!branch) {
            return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
        }

        return NextResponse.json(branch, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch branch' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]'>
) {
    const { branchId: branchIdParam } = await ctx.params;

    const branchId = parseNumericId(branchIdParam);

    if (branchId === null) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, BranchUpdateSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE]);
        requireBranchAccess(user, branchId);

        const branch = await BranchService.updateBranch(branchId, parsed.data);
        return NextResponse.json(branch, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 })
    }
}
