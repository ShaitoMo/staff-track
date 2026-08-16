import { NextRequest, NextResponse } from 'next/server'
import { ShiftService } from '@/services/shift-service'
import { UpdateShiftSchema } from '@/types/shift'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { RegisterNotAtBranchError } from '@/exceptions/register-not-at-branch-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { ShiftOverlapError } from '@/exceptions/shift-overlap-error'
import { ShiftNotFoundError } from '@/exceptions/shift-not-found-error'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/shifts/[shiftId]'>
) {
    const { shiftId: shiftIdParam } = await ctx.params;

    if (!/^\d+$/.test(shiftIdParam)) {
        return NextResponse.json({ error: 'Invalid shiftId' }, { status: 400 });
    }

    const shiftId = Number(shiftIdParam);

    const shift = await ShiftService.getShiftById(shiftId);

    if (!shift) {
        return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json(shift, { status: 200 });
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

    if (!/^\d+$/.test(shiftIdParam)) {
        return NextResponse.json({ error: 'Invalid shiftId' }, { status: 400 });
    }

    const shiftId = Number(shiftIdParam);

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
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
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const shift = await ShiftService.updateShift(shiftId, validationResult.data);
        return NextResponse.json(shift, { status: 200 });
    } catch (error) {
        if (error instanceof ShiftNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof ShiftOverlapError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (error instanceof RegisterNotAtBranchError) {
            return NextResponse.json({ error: error.message }, { status: 422 })
        }
        if (
            error instanceof UserNotFoundError ||
            error instanceof BranchNotFoundError ||
            error instanceof RegisterNotFoundError ||
            error instanceof UserNotAtBranchError
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
    }
}

/** DELETE /api/shifts/:shiftId — unschedules a shift. */
export async function DELETE(
    _req: NextRequest,
    ctx: RouteContext<'/api/shifts/[shiftId]'>
) {
    const { shiftId: shiftIdParam } = await ctx.params;

    if (!/^\d+$/.test(shiftIdParam)) {
        return NextResponse.json({ error: 'Invalid shiftId' }, { status: 400 });
    }

    try {
        await ShiftService.deleteShift(Number(shiftIdParam));
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof ShiftNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
    }
}
