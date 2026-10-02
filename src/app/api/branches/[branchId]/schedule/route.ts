import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseNumericId, zodErrorResponse } from '@/lib/route-utils'
import { ShiftService } from '@/services/shift-service'
import { BranchScheduleQuerySchema } from '@/types/shift'
import { requireBranchAccess } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { logger } from '@/lib/logger'

/**
 * GET /api/branches/:branchId/schedule?week_start=YYYY-MM-DD
 *
 * The branch's week as its staff see it: who works which period, by name. Open to every role —
 * branch membership is the only gate, unlike GET /api/shifts, which is the manager's editable view.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]/schedule'>
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

    const validationResult = BranchScheduleQuerySchema.safeParse({
        week_start: req.nextUrl.searchParams.get('week_start') ?? undefined,
    })

    if (!validationResult.success) {
        return zodErrorResponse(validationResult.error)
    }

    try {
        requireBranchAccess(user, branchId)
        const schedule = await ShiftService.getBranchSchedule(branchId, validationResult.data);
        return NextResponse.json(schedule, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to fetch branch schedule');
        return NextResponse.json({ error: 'Failed to fetch branch schedule' }, { status: 500 });
    }
}
