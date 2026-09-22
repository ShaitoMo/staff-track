import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { UserTaskInstanceFiltersSchema } from '@/types/task-instance'
import { MANAGER_ROLE, OWNER_ROLE, requireSelfOrRole } from '@/lib/rbac'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { logger } from '@/lib/logger'

/**
 * GET /api/users/:userId/tasks?status=&due_from=&due_to=
 *
 * A worker's task list: instances of tasks assigned to them personally, plus unclaimed
 * instances of tasks targeting their role at a branch they work at. Both date bounds are
 * optional and inclusive.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/tasks'>
) {
    const { userId: userIdParam } = await ctx.params;

    if (!/^\d+$/.test(userIdParam)) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const userId = Number(userIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const searchParams = req.nextUrl.searchParams

    const validationResult = UserTaskInstanceFiltersSchema.safeParse({
        status: searchParams.get('status') ?? undefined,
        due_from: searchParams.get('due_from') ?? undefined,
        due_to: searchParams.get('due_to') ?? undefined,
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
        const instances = await TaskInstanceService.getTaskInstancesForUser(userId, validationResult.data);
        return NextResponse.json(instances, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to fetch tasks');
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
}
