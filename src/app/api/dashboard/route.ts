import { NextRequest, NextResponse } from 'next/server'
import { DashboardService } from '@/services/dashboard-service'
import { DashboardFiltersSchema } from '@/types/dashboard'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { InvalidDateRangeError } from '@/exceptions/invalid-date-range-error'
import { logger } from '@/lib/logger'

/**
 * GET /api/dashboard?branch_id=&from=&to= — attendance, task and coverage summary for a range
 * (FR11). Omitting `branch_id` is the owner-only all-branches view (FR10); a manager must name
 * their own branch. `from`/`to` default to today. An unknown `branch_id` is a 400, not 404 — the
 * report is the resource, the request describing it is what's wrong.
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams

    const validationResult = DashboardFiltersSchema.safeParse({
        branch_id: searchParams.get('branch_id') ?? undefined,
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

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        const { branch_id: branchId } = validationResult.data

        if (branchId === undefined) {
            requireRole(user, [OWNER_ROLE])
        } else {
            requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
            requireBranchAccess(user, branchId)
        }

        const dashboard = await DashboardService.getDashboard(validationResult.data)

        return NextResponse.json(dashboard, { status: 200 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        if (error instanceof InvalidDateRangeError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to build dashboard');
        return NextResponse.json({ error: 'Failed to build dashboard' }, { status: 500 })
    }
}
