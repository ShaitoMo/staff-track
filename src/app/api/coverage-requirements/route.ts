import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { CoverageRequirementService } from '@/services/coverage-requirement-service'
import { CoverageRequirementFiltersSchema, CreateCoverageRequirementSchema } from '@/types/coverage-requirement'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error'
import { DuplicateCoverageRequirementError } from '@/exceptions/duplicate-coverage-requirement-error'
import { logger } from '@/lib/logger'

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
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
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
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to fetch coverage requirements')
        return NextResponse.json({ error: 'Failed to fetch coverage requirements' }, { status: 500 })
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
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = CreateCoverageRequirementSchema.safeParse(body);

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
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
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (
            error instanceof BranchNotFoundError ||
            error instanceof RoleNotFoundError ||
            error instanceof ShiftPeriodNotFoundError ||
            error instanceof ShiftPeriodNotAtBranchError
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to create coverage requirement')
        return NextResponse.json({ error: 'Failed to create coverage requirement' }, { status: 500 })
    }
}
