import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { PeriodService } from '@/services/period-service'
import { UpdatePeriodSchema } from '@/types/shift-period'
import { AccessTokenPayload } from '@/types/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { PeriodInUseError } from '@/exceptions/period-in-use-error'
import { DuplicatePeriodNameError } from '@/exceptions/duplicate-period-name-error'
import { logger } from '@/lib/logger'

/** A chain-wide period (branchId null) is owner-only to touch; a branch's own just needs access to it. */
function assertMayTouchPeriod(user: AccessTokenPayload, branchId: number | null): void {
    if (branchId === null) {
        requireRole(user, [OWNER_ROLE])
        return
    }

    requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
    requireBranchAccess(user, branchId)
}

/**
 * GET /api/periods/:id — for the edit page. Readable by whoever sees it in the list: a branch's
 * period needs access to that branch, a chain-wide one is visible to every owner and manager.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/periods/[periodId]'>
) {
    const periodId = parseNumericId((await ctx.params).periodId);

    if (periodId === null) {
        return NextResponse.json({ error: 'Invalid periodId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])

        const period = await PeriodService.getPeriodView(periodId);

        if (!period) {
            return NextResponse.json({ error: 'Period not found' }, { status: 404 });
        }

        if (period.branchId !== null) {
            requireBranchAccess(user, period.branchId)
        }

        return NextResponse.json(period, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch period')
        return NextResponse.json({ error: 'Failed to fetch period' }, { status: 500 })
    }
}

/** PATCH /api/periods/:id — name, defaultStart, defaultEnd, sortOrder, active. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/periods/[periodId]'>
) {
    const periodId = parseNumericId((await ctx.params).periodId);

    if (periodId === null) {
        return NextResponse.json({ error: 'Invalid periodId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await PeriodService.getPeriodById(periodId);

    if (!existing) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // one readable message on a 400, so the periods form can show it as is
    const parsed = await parseJsonBody(req, UpdatePeriodSchema);

    if (parsed.error) {
        return parsed.error
    }

    try {
        assertMayTouchPeriod(user, existing.branchId)
        const period = await PeriodService.updatePeriod(periodId, parsed.data);
        return NextResponse.json(period, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof ShiftPeriodNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof DuplicatePeriodNameError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        logger.error({ err: error }, 'Failed to update period')
        return NextResponse.json({ error: 'Failed to update period' }, { status: 500 })
    }
}

/** DELETE /api/periods/:id — refused with 409 while any shift or coverage requirement references it. */
export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/periods/[periodId]'>
) {
    const periodId = parseNumericId((await ctx.params).periodId);

    if (periodId === null) {
        return NextResponse.json({ error: 'Invalid periodId' }, { status: 400 });
    }

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
        logger.error({ err: error }, 'Failed to delete period')
        return NextResponse.json({ error: 'Failed to delete period' }, { status: 500 })
    }
}
