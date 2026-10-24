import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { AttendanceService } from '@/services/attendance-service'
import { requireBranchAccess } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { logger } from '@/lib/logger'

/**
 * GET /api/branches/:id/attendance-freshness
 *
 * How far the branch's clock data goes. Open to anyone at the branch, staff included: it is one
 * instant, and their own attendance page needs it to tell a missed shift from one not imported yet.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]/attendance-freshness'>
) {
    const { branchId: branchIdParam } = await ctx.params;

    if (!/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const branchId = Number(branchIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireBranchAccess(user, branchId)
        const freshness = await AttendanceService.getFreshness(branchId);
        return NextResponse.json(freshness, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to fetch attendance freshness');
        return NextResponse.json({ error: 'Failed to fetch attendance freshness' }, { status: 500 });
    }
}
