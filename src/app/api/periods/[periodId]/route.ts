import { NextRequest, NextResponse } from 'next/server'
import { PeriodService } from '@/services/period-service'
import { UpdatePeriodSchema } from '@/types/shift-period'
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { PeriodInUseError } from '@/exceptions/period-in-use-error'

/** PATCH /api/periods/:id — name, defaultStart, defaultEnd, sortOrder. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/periods/[periodId]'>
) {
    const { periodId: periodIdParam } = await ctx.params;

    if (!/^\d+$/.test(periodIdParam)) {
        return NextResponse.json({ error: 'Invalid periodId' }, { status: 400 });
    }

    const periodId = Number(periodIdParam);

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = UpdatePeriodSchema.safeParse(body);

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const period = await PeriodService.updatePeriod(periodId, validationResult.data);
        return NextResponse.json(period, { status: 200 });
    } catch (error) {
        if (error instanceof ShiftPeriodNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update period' }, { status: 500 })
    }
}

/** DELETE /api/periods/:id — refused with 409 while any shift or coverage requirement references it. */
export async function DELETE(
    _req: NextRequest,
    ctx: RouteContext<'/api/periods/[periodId]'>
) {
    const { periodId: periodIdParam } = await ctx.params;

    if (!/^\d+$/.test(periodIdParam)) {
        return NextResponse.json({ error: 'Invalid periodId' }, { status: 400 });
    }

    try {
        await PeriodService.deletePeriod(Number(periodIdParam));
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof ShiftPeriodNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof PeriodInUseError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete period' }, { status: 500 })
    }
}
