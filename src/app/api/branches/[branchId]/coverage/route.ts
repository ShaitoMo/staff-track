import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { CoverageGapsService } from '@/services/coverage-gaps-service'
import { CoverageGapsFiltersSchema } from '@/types/coverage-gap'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse, validationErrorResponse } from '@/lib/error-response'

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
        return invalidIdResponse('branchId');
    }

    const branchId = Number(branchIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const searchParams = req.nextUrl.searchParams
    const validationResult = CoverageGapsFiltersSchema.safeParse({
        weekStart: searchParams.get('weekStart') ?? undefined,
    })

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error)
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, branchId)
        const rows = await CoverageGapsService.getCoverageGaps(branchId, validationResult.data.weekStart)
        return NextResponse.json(rows, { status: 200 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to compute coverage gaps')
        return internalErrorResponse('Failed to compute coverage gaps')
    }
}
