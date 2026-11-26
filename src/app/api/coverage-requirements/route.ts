import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { CoverageRequirementService } from '@/services/coverage-requirement-service'
import { CoverageRequirementFiltersSchema, CreateCoverageRequirementSchema } from '@/types/coverage-requirement'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error'
import { ShiftPeriodInactiveError } from '@/exceptions/shift-period-inactive-error'
import { DuplicateCoverageRequirementError } from '@/exceptions/duplicate-coverage-requirement-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

/**
 * GET /api/coverage-requirements?branchId=
 *
 * A branch's requirements with role and period expanded, so the UI can render the roles × periods
 * grid without a fetch per row.
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams

    const validationResult = CoverageRequirementFiltersSchema.safeParse({
        branchId: searchParams.get('branchId') ?? undefined,
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
        const requirements = await CoverageRequirementService.getRequirementsByBranch(validationResult.data.branchId)
        return NextResponse.json(requirements, { status: 200 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to fetch coverage requirements')
        return internalErrorResponse('Failed to fetch coverage requirements')
    }
}

/**
 * POST /api/coverage-requirements
 *
 * A duplicate (branchId, roleId, periodId) is a 409, not a silent upsert — the client re-sends the
 * edit as a PATCH against the existing row instead.
 */
export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return invalidJsonResponse()
    }

    const validationResult = CreateCoverageRequirementSchema.safeParse(body);

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, validationResult.data.branchId)
        const requirement = await CoverageRequirementService.createRequirement(validationResult.data);
        return NextResponse.json(requirement, { status: 201 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof DuplicateCoverageRequirementError) {
            return appErrorResponse(error, 409)
        }
        if (
            error instanceof BranchNotFoundError ||
            error instanceof RoleNotFoundError ||
            error instanceof ShiftPeriodNotFoundError ||
            error instanceof ShiftPeriodNotAtBranchError ||
            error instanceof ShiftPeriodInactiveError
        ) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to create coverage requirement')
        return internalErrorResponse('Failed to create coverage requirement')
    }
}
