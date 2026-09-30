import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils';
import { TaskService } from "@/services/task-service";
import { CreateTaskSchema } from "@/types/task";
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from "@/lib/rbac";
import { BranchNotFoundError } from "@/exceptions/branch-not-found-error";
import { RoleNotFoundError } from "@/exceptions/role-not-found-error";
import { UserNotAtBranchError } from "@/exceptions/user-not-at-branch-error";
import { InvalidTaskAssignmentError } from "@/exceptions/invalid-task-assignment-error";
import { InvalidRecurrenceError } from "@/exceptions/invalid-recurrence-error";

export async function GET(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])

        const tasks = await TaskService.getAllTasks();
        const visible = user.role === OWNER_ROLE
            ? tasks
            : tasks.filter((task) => user.branchIds.includes(task.branch_id))

        return NextResponse.json(visible, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
}

/**
 * POST /api/tasks — creates a task definition and the instances that make it visible to workers.
 */
export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = CreateTaskSchema.safeParse(body);

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, validationResult.data.branch_id)
        const task = await TaskService.createTask({ ...validationResult.data, assigned_by: user.userId });
        return NextResponse.json(task, { status: 201 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (
            error instanceof BranchNotFoundError ||
            error instanceof RoleNotFoundError ||
            error instanceof UserNotAtBranchError ||
            error instanceof InvalidTaskAssignmentError ||
            error instanceof InvalidRecurrenceError
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }
}
