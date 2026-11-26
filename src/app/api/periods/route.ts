import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseJsonBody } from '@/lib/route-utils'
import { PeriodService } from '@/services/period-service'
import { CreatePeriodSchema, PeriodFiltersSchema } from '@/types/shift-period'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { DuplicatePeriodNameError } from '@/exceptions/duplicate-period-name-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, validationErrorResponse } from '@/lib/error-response'

/**
 * GET /api/periods?branchId=&includeInactive=true
 *
 * Periods available to a branch: its own plus every chain-wide one, ordered the way a picker
 * should list them (sort_order, then name). Only periods that are on, unless `includeInactive=true`
 * (the periods page, which is where they are turned back on).
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams

    const validationResult = PeriodFiltersSchema.safeParse({
        branchId: searchParams.get('branchId') ?? undefined,
        includeInactive: searchParams.get('includeInactive') ?? undefined,
    })

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error)
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, validationResult.data.branchId)
        const { branchId, includeInactive } = validationResult.data
        const periods = await PeriodService.getPeriodsByBranch(branchId, includeInactive === 'true')
        return NextResponse.json(periods, { status: 200 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to fetch periods')
        return internalErrorResponse('Failed to fetch periods')
    }
}

/** POST /api/periods — branchId is optional; null or omitted means a chain-wide period. */
export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    // one readable message on a 400, so the periods form can show it as is
    const parsed = await parseJsonBody(req, CreatePeriodSchema);

    if (parsed.error) {
        return parsed.error
    }

    try {
        // A chain-wide period (no branchId) is owner-only; a branch-specific one just needs access to it.
        if (parsed.data.branchId === null || parsed.data.branchId === undefined) {
            requireRole(user, [OWNER_ROLE])
        } else {
            requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
            requireBranchAccess(user, parsed.data.branchId)
        }

        const period = await PeriodService.createPeriod(parsed.data);
        return NextResponse.json(period, { status: 201 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return appErrorResponse(error, 400)
        }
        if (error instanceof DuplicatePeriodNameError) {
            return appErrorResponse(error, 409)
        }
        logger.error({ err: error }, 'Failed to create period')
        return internalErrorResponse('Failed to create period')
    }
}
