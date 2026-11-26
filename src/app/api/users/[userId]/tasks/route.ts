import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { UserTaskInstanceFiltersSchema } from '@/types/task-instance'
import { MANAGER_ROLE, OWNER_ROLE, requireCallerCanReachUser, requireSelfOrRole } from '@/lib/rbac'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse, validationErrorResponse } from '@/lib/error-response'

/**
 * GET /api/users/:userId/tasks?status=&due_from=&due_to=&completed_from=
 *
 * A worker's task list: instances of tasks assigned to them personally, plus unclaimed
 * instances of tasks targeting their role at a branch they work at. All date bounds are
 * optional and inclusive.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/tasks'>
) {
    const { userId: userIdParam } = await ctx.params;

    if (!/^\d+$/.test(userIdParam)) {
        return invalidIdResponse('userId');
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
        completed_from: searchParams.get('completed_from') ?? undefined,
    })

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error)
    }

    try {
        requireSelfOrRole(user, userId, [OWNER_ROLE, MANAGER_ROLE])
        await requireCallerCanReachUser(user, userId)
        const instances = await TaskInstanceService.getTaskInstancesForUser(userId, validationResult.data);

        // Sharing one branch with the worker doesn't entitle a manager to their tasks at the others.
        const visible = user.role === MANAGER_ROLE && user.userId !== userId
            ? instances.filter(instance => user.branchIds.includes(instance.task.branch_id))
            : instances;

        return NextResponse.json(visible, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserNotFoundError) {
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to fetch tasks');
        return internalErrorResponse('Failed to fetch tasks');
    }
}
