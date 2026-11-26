import { NextRequest, NextResponse } from 'next/server'
import { DashboardService } from '@/services/dashboard-service'
import { DashboardFiltersSchema } from '@/types/dashboard'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { InvalidDateRangeError } from '@/exceptions/invalid-date-range-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, unauthenticatedResponse, validationErrorResponse } from '@/lib/error-response'

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
        return validationErrorResponse(validationResult.error)
    }

    const user = getCurrentUser(req)

    if (!user) {
        return unauthenticatedResponse()
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
            return appErrorResponse(error, 403)
        }
        if (error instanceof BranchNotFoundError) {
            return appErrorResponse(error, 400)
        }
        if (error instanceof InvalidDateRangeError) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to build dashboard')
        return internalErrorResponse('Failed to build dashboard')
    }
}
