import { NextRequest, NextResponse } from 'next/server'
import { ShiftService } from '@/services/shift-service'
import { UpdateShiftSchema } from '@/types/shift'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { RegisterNotAtBranchError } from '@/exceptions/register-not-at-branch-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { ShiftOverlapError } from '@/exceptions/shift-overlap-error'
import { RegisterOverlapError } from '@/exceptions/register-overlap-error'
import { ShiftNotFoundError } from '@/exceptions/shift-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/shifts/[shiftId]'>
) {
    const { shiftId: shiftIdParam } = await ctx.params;

    const shiftId = parseNumericId(shiftIdParam);

    if (shiftId === null) {
        return invalidIdResponse('shiftId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const shift = await ShiftService.getShiftById(shiftId);

        if (!shift) {
            return appErrorResponse(new ShiftNotFoundError(), 404);
        }

        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, shift.branch_id)

        return NextResponse.json(shift, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch shift');
        return internalErrorResponse('Failed to fetch shift');
    }
}

/**
 * PATCH /api/shifts/:shiftId — moves a shift.
 *
 * The refusals split the way POST's do: a clash is a 409 because the body is fine and may succeed
 * once the other shift moves, and a register at the wrong branch is a 422 because the body is
 * well-formed but names a pair that cannot exist.
 */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/shifts/[shiftId]'>
) {
    const { shiftId: shiftIdParam } = await ctx.params;

    const shiftId = parseNumericId(shiftIdParam);

    if (shiftId === null) {
        return invalidIdResponse('shiftId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await ShiftService.getShiftById(shiftId);

    if (!existing) {
        return appErrorResponse(new ShiftNotFoundError(), 404);
    }

    let body
    try {
        body = await req.json();
    } catch {
        return invalidJsonResponse()
    }

    // named one by one, which is also what keeps created_by out of an edit
    const { user_id, branch_id, register_id, shift_date, start_time, end_time } = body;

    const validationResult = UpdateShiftSchema.safeParse({
        user_id,
        branch_id,
        register_id,
        shift_date,
        start_time,
        end_time,
    });

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, existing.branch_id)

        if (validationResult.data.branch_id !== undefined) {
            requireBranchAccess(user, validationResult.data.branch_id)
        }

        const shift = await ShiftService.updateShift(shiftId, validationResult.data);
        return NextResponse.json(shift, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof ShiftNotFoundError) {
            return appErrorResponse(error, 404)
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
            error instanceof UserNotAtBranchError
        ) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to update shift')
        return internalErrorResponse('Failed to update shift')
    }
}

/** DELETE /api/shifts/:shiftId — unschedules a shift. */
export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/shifts/[shiftId]'>
) {
    const { shiftId: shiftIdParam } = await ctx.params;

    const shiftId = parseNumericId(shiftIdParam);

    if (shiftId === null) {
        return invalidIdResponse('shiftId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await ShiftService.getShiftById(shiftId);

    if (!existing) {
        return appErrorResponse(new ShiftNotFoundError(), 404);
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, existing.branch_id)
        await ShiftService.deleteShift(shiftId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof ShiftNotFoundError) {
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to delete shift')
        return internalErrorResponse('Failed to delete shift')
    }
}
