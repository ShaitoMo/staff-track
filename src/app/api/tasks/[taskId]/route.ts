import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { TaskService } from '@/services/task-service'
import { UpdateTaskSchema } from '@/types/task'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { TaskNotFoundError } from '@/exceptions/task-not-found-error'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { InvalidTaskAssignmentError } from '@/exceptions/invalid-task-assignment-error'
import { InvalidScheduleChangeError } from '@/exceptions/invalid-schedule-change-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/tasks/[taskId]'>
) {
    const { taskId: taskIdParam } = await ctx.params;

    if (!/^\d+$/.test(taskIdParam)) {
        return invalidIdResponse('taskId');
    }

    const taskId = Number(taskIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])

        const task = await TaskService.getTaskById(taskId);

        if (!task) {
            return appErrorResponse(new TaskNotFoundError(), 404);
        }

        requireBranchAccess(user, task.branch_id)

        return NextResponse.json(task, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch task');
        return internalErrorResponse('Failed to fetch task');
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/tasks/[taskId]'>
) {
    const { taskId: taskIdParam } = await ctx.params;

    if (!/^\d+$/.test(taskIdParam)) {
        return invalidIdResponse('taskId');
    }

    const taskId = Number(taskIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        throw error
    }

    let body
    try {
        body = await req.json();
    } catch {
        return invalidJsonResponse()
    }

    const validationResult = UpdateTaskSchema.safeParse(body);

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
    }

    try {
        const existing = await TaskService.getTaskById(taskId);

        if (!existing) {
            return appErrorResponse(new TaskNotFoundError(), 404);
        }

        requireBranchAccess(user, existing.branch_id)
        const task = await TaskService.updateTask(taskId, validationResult.data);
        return NextResponse.json(task, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof TaskNotFoundError) {
            return appErrorResponse(error, 404)
        }
        if (
            error instanceof InvalidTaskAssignmentError ||
            error instanceof InvalidScheduleChangeError ||
            error instanceof RoleNotFoundError ||
            error instanceof UserNotAtBranchError
        ) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to update task')
        return internalErrorResponse('Failed to update task')
    }
}
