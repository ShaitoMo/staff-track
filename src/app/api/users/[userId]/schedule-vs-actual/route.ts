import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { ScheduleVsActualService } from '@/services/schedule-vs-actual-service'
import { ScheduleVsActualFiltersSchema } from '@/types/schedule-vs-actual'
import { MANAGER_ROLE, OWNER_ROLE, requireCallerCanReachUser, requireSelfOrRole } from '@/lib/rbac'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { logger } from '@/lib/logger'

/**
 * GET /api/users/:userId/schedule-vs-actual?from=&to=
 *
 * One user's shifts in the window against their punches — the staff member's own attendance
 * (FR6). Staff may read only themselves; a manager sees only the rows at their branches.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/schedule-vs-actual'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const searchParams = req.nextUrl.searchParams

    const validationResult = ScheduleVsActualFiltersSchema.safeParse({
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
        requireSelfOrRole(user, userId, [OWNER_ROLE, MANAGER_ROLE])
        // A manager may only ask about someone sharing one of their branches — a 403 otherwise,
        // the same for a stranger as for a user that doesn't exist.
        await requireCallerCanReachUser(user, userId)

        const rows = await ScheduleVsActualService.getScheduleVsActual({ ...validationResult.data, user_id: userId })
        // someone shared with this manager may also work a branch the manager can't see
        const visible = user.role === MANAGER_ROLE && user.userId !== userId
            ? rows.filter((row) => user.branchIds.includes(row.branch_id))
            : rows

        return NextResponse.json(visible, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to compare schedule with attendance');
        return NextResponse.json({ error: 'Failed to compare schedule with attendance' }, { status: 500 });
    }
}
