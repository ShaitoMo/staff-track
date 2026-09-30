import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { PeriodService } from '@/services/period-service'
import { UpdatePeriodSchema } from '@/types/shift-period'
import { AccessTokenPayload } from '@/types/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { PeriodInUseError } from '@/exceptions/period-in-use-error'

/** A chain-wide period (branchId null) is owner-only to touch; a branch's own just needs access to it. */
function assertMayTouchPeriod(user: AccessTokenPayload, branchId: number | null): void {
    if (branchId === null) {
        requireRole(user, [OWNER_ROLE])
        return
    }

    requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
    requireBranchAccess(user, branchId)
}

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

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await PeriodService.getPeriodById(periodId);

    if (!existing) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

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
        assertMayTouchPeriod(user, existing.branchId)
        const period = await PeriodService.updatePeriod(periodId, validationResult.data);
        return NextResponse.json(period, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof ShiftPeriodNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update period' }, { status: 500 })
    }
}

/** DELETE /api/periods/:id — refused with 409 while any shift or coverage requirement references it. */
export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/periods/[periodId]'>
) {
    const { periodId: periodIdParam } = await ctx.params;

    if (!/^\d+$/.test(periodIdParam)) {
        return NextResponse.json({ error: 'Invalid periodId' }, { status: 400 });
    }

    const periodId = Number(periodIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await PeriodService.getPeriodById(periodId);

    if (!existing) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    try {
        assertMayTouchPeriod(user, existing.branchId)
        await PeriodService.deletePeriod(periodId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
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
