import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { ShiftService } from '@/services/shift-service'
import { CreateShiftSchema, ShiftFiltersSchema } from '@/types/shift'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { RegisterNotAtBranchError } from '@/exceptions/register-not-at-branch-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { ShiftOverlapError } from '@/exceptions/shift-overlap-error'
import { RegisterOverlapError } from '@/exceptions/register-overlap-error'
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error'
import { ShiftPeriodInactiveError } from '@/exceptions/shift-period-inactive-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

//GET /api/shifts?branch_id=&user_id=&register_id=&from=&to=

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams

    const validationResult = ShiftFiltersSchema.safeParse({
        branch_id: searchParams.get('branch_id') ?? undefined,
        user_id: searchParams.get('user_id') ?? undefined,
        register_id: searchParams.get('register_id') ?? undefined,
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
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

        if (validationResult.data.branch_id !== undefined) {
            requireBranchAccess(user, validationResult.data.branch_id)
        }

        const shifts = await ShiftService.getShifts(validationResult.data)
        const visible = user.role === OWNER_ROLE
            ? shifts
            : shifts.filter((shift) => user.branchIds.includes(shift.branch_id))

        return NextResponse.json(visible, { status: 200 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch shifts')
        return internalErrorResponse('Failed to fetch shifts')
    }
}

/**
 * POST /api/shifts — schedules a shift. A clashing shift is a 409 (the same body may succeed
 * later); a register at the wrong branch is a 422 (well-formed, but names a pair that can't exist).
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

    const validationResult = CreateShiftSchema.safeParse(body);

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, validationResult.data.branch_id)
        const shift = await ShiftService.createShift({ ...validationResult.data, created_by: user.userId });
        return NextResponse.json(shift, { status: 201 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof ShiftOverlapError || error instanceof RegisterOverlapError) {
            return appErrorResponse(error, 409)
        }
        if (error instanceof RegisterNotAtBranchError) {
            return appErrorResponse(error, 422)
        }
        if (
            error instanceof UserNotFoundError ||
            error instanceof BranchNotFoundError ||
            error instanceof RegisterNotFoundError ||
            error instanceof UserNotAtBranchError ||
            error instanceof ShiftPeriodNotFoundError ||
            error instanceof ShiftPeriodNotAtBranchError ||
            error instanceof ShiftPeriodInactiveError
        ) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to create shift')
        return internalErrorResponse('Failed to create shift')
    }
}
