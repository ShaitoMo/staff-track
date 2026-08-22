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
 * GET /api/dashboard?branch_id=&from=&to=
 *
 * Attendance, task completion and coverage summary for a date range (FR11). Omitting `branch_id`
 * is the all-branches view and is owner-only, mirroring FR10's "owner sees all branches"; a
 * manager must name one of their own branches. `from`/`to` default to today when omitted.
 *
 * A `branch_id` naming a branch that does not exist is a 400, not a 404, matching
 * schedule-vs-actual: the report is the resource being addressed, the request describing it is
 * what is wrong.
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
