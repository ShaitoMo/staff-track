import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { ScheduleVsActualService } from '@/services/schedule-vs-actual-service'
import { ScheduleVsActualFiltersSchema } from '@/types/schedule-vs-actual'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'

/**
 * GET /api/schedule-vs-actual?branch_id=&user_id=&from=&to=
 *
 * One row per scheduled shift in the window, with the punches recorded against it and how far
 * either end slipped (FR6). `from` and `to` are required and bound `shift_date` inclusively;
 * `branch_id` and `user_id` narrow it further.
 *
 * A filter naming a branch or user that does not exist is a 400, not a 404: the report is the
 * resource being addressed and it exists, the request describing it is what is wrong.
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams

    const validationResult = ScheduleVsActualFiltersSchema.safeParse({
        branch_id: searchParams.get('branch_id') ?? undefined,
        user_id: searchParams.get('user_id') ?? undefined,
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

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])

        if (validationResult.data.branch_id !== undefined) {
            requireBranchAccess(user, validationResult.data.branch_id)
        }

        const rows = await ScheduleVsActualService.getScheduleVsActual(validationResult.data)
        const visible = user.role === OWNER_ROLE
            ? rows
            : rows.filter((row) => user.branchIds.includes(row.branch_id))

        return NextResponse.json(visible, { status: 200 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError || error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to compare schedule with attendance' }, { status: 500 })
    }
}
