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

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/tasks/[taskId]'>
) {
    const { taskId: taskIdParam } = await ctx.params;

    if (!/^\d+$/.test(taskIdParam)) {
        return NextResponse.json({ error: 'Invalid taskId' }, { status: 400 });
    }

    const taskId = Number(taskIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const task = await TaskService.getTaskById(taskId);

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, task.branch_id)

        return NextResponse.json(task, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch task');
        return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/tasks/[taskId]'>
) {
    const { taskId: taskIdParam } = await ctx.params;

    if (!/^\d+$/.test(taskIdParam)) {
        return NextResponse.json({ error: 'Invalid taskId' }, { status: 400 });
    }

    const taskId = Number(taskIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await TaskService.getTaskById(taskId);

    if (!existing) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { title, description, assigned_to, assigned_role_id, is_recurring, recurrence, active } = body;

    const validationResult = UpdateTaskSchema.safeParse({
        title,
        description,
        assigned_to,
        assigned_role_id,
        is_recurring,
        recurrence,
        active,
    });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, existing.branch_id)
        const task = await TaskService.updateTask(taskId, validationResult.data);
        return NextResponse.json(task, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof TaskNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (
            error instanceof InvalidTaskAssignmentError ||
            error instanceof InvalidScheduleChangeError ||
            error instanceof RoleNotFoundError ||
            error instanceof UserNotAtBranchError
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to update task')
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
}
