import { NextRequest, NextResponse } from 'next/server'
import { TaskService } from '@/services/task-service'
import { UpdateTaskSchema } from '@/types/task'
import { TaskNotFoundError } from '@/exceptions/task-not-found-error'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { InvalidTaskAssignmentError } from '@/exceptions/invalid-task-assignment-error'
import { InvalidScheduleChangeError } from '@/exceptions/invalid-schedule-change-error'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/tasks/[taskId]'>
) {
    const { taskId: taskIdParam } = await ctx.params;

    if (!/^\d+$/.test(taskIdParam)) {
        return NextResponse.json({ error: 'Invalid taskId' }, { status: 400 });
    }

    const taskId = Number(taskIdParam);

    try {
        const task = await TaskService.getTaskById(taskId);

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json(task, { status: 200 });
    } catch (error) {
        console.error(error);
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
        const task = await TaskService.updateTask(taskId, validationResult.data);
        return NextResponse.json(task, { status: 200 });
    } catch (error) {
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
        console.error(error);
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
}
