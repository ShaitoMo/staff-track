import { NextRequest, NextResponse } from 'next/server'
import { PeriodService } from '@/services/period-service'
import { CreatePeriodSchema, PeriodFiltersSchema } from '@/types/shift-period'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { logger } from '@/lib/logger'

/**
 * GET /api/periods?branchId=
 *
 * Periods available to a branch: its own plus every chain-wide one, ordered the way a picker
 * should list them (sort_order, then name).
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams

    const validationResult = PeriodFiltersSchema.safeParse({
        branchId: searchParams.get('branchId') ?? undefined,
    })

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, validationResult.data.branchId)
        const periods = await PeriodService.getPeriodsByBranch(validationResult.data.branchId)
        return NextResponse.json(periods, { status: 200 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to fetch periods');
        return NextResponse.json({ error: 'Failed to fetch periods' }, { status: 500 })
    }
}

/** POST /api/periods — branchId is optional; null or omitted means a chain-wide period. */
export async function POST(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = CreatePeriodSchema.safeParse(body);

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        // A chain-wide period (no branchId) is owner-only; a branch-specific one just needs access to it.
        if (validationResult.data.branchId === null || validationResult.data.branchId === undefined) {
            requireRole(user, [OWNER_ROLE])
        } else {
            requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
            requireBranchAccess(user, validationResult.data.branchId)
        }

        const period = await PeriodService.createPeriod(validationResult.data);
        return NextResponse.json(period, { status: 201 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to create period');
        return NextResponse.json({ error: 'Failed to create period' }, { status: 500 })
    }
}
