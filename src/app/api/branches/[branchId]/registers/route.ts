import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]/registers'>
) {
    const { branchId: branchIdParam } = await ctx.params;

    if (!/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const branchId = Number(branchIdParam);

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, branchId)
        const registers = await RegisterService.getRegistersByBranch(branchId);
        return NextResponse.json(registers, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch registers' }, { status: 500 });
    }
}
