import { NextRequest, NextResponse } from 'next/server'
import { CoverageGapsService } from '@/services/coverage-gaps-service'
import { CoverageGapsFiltersSchema } from '@/types/coverage-gap'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { logger } from '@/lib/logger'

/**
 * GET /api/branches/:id/coverage?weekStart=
 *
 * One row per (shiftDate, role, period) with requiredCount against scheduledCount, over the seven
 * days starting at weekStart. Every requirement applies to every date now that CoverageRequirement
 * has no weekday — see resolveCoverageGaps.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]/coverage'>
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

    const searchParams = req.nextUrl.searchParams
    const validationResult = CoverageGapsFiltersSchema.safeParse({
        weekStart: searchParams.get('weekStart') ?? undefined,
    })

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, branchId)
        const rows = await CoverageGapsService.getCoverageGaps(branchId, validationResult.data.weekStart)
        return NextResponse.json(rows, { status: 200 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to compute coverage gaps');
        return NextResponse.json({ error: 'Failed to compute coverage gaps' }, { status: 500 })
    }
}
