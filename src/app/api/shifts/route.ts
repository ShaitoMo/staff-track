import { NextRequest, NextResponse } from 'next/server'
import { ShiftService } from '@/services/shift-service'
import { CreateShiftSchema, ShiftFiltersSchema } from '@/types/shift'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { RegisterNotAtBranchError } from '@/exceptions/register-not-at-branch-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { ShiftOverlapError } from '@/exceptions/shift-overlap-error'
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error'

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
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const shifts = await ShiftService.getShifts(validationResult.data)
        return NextResponse.json(shifts, { status: 200 })
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
    }
}

/**
 * POST /api/shifts — schedules a shift.
 *
 * Two refusals are separated from the rest of the 400s because a client acts on them differently:
 * a clashing shift is a 409, since nothing about the request is malformed and the same body may
 * succeed once the other shift moves, and a register at the wrong branch is a 422, since the body
 * is well-formed but names a pair that cannot exist.
 */
export async function POST(req: NextRequest) {
    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = CreateShiftSchema.safeParse(body);

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const shift = await ShiftService.createShift(validationResult.data);
        return NextResponse.json(shift, { status: 201 })
    } catch (error) {
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
            error instanceof UserNotAtBranchError ||
            error instanceof ShiftPeriodNotFoundError ||
            error instanceof ShiftPeriodNotAtBranchError
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
    }
}
