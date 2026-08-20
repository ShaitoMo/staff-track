import { NextRequest, NextResponse } from "next/server";
import { TaskService } from "@/services/task-service";
import { CreateTaskSchema } from "@/types/task";
import { getCurrentUser } from "@/lib/auth";
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from "@/lib/rbac";
import { ForbiddenError } from "@/exceptions/forbidden-error";
import { BranchNotFoundError } from "@/exceptions/branch-not-found-error";
import { RoleNotFoundError } from "@/exceptions/role-not-found-error";
import { UserNotAtBranchError } from "@/exceptions/user-not-at-branch-error";
import { InvalidTaskAssignmentError } from "@/exceptions/invalid-task-assignment-error";
import { InvalidRecurrenceError } from "@/exceptions/invalid-recurrence-error";

export async function GET(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        throw error
    }

    const tasks = await TaskService.getAllTasks();
    const visible = user.role === OWNER_ROLE
        ? tasks
        : tasks.filter((task) => user.branchIds.includes(task.branch_id))

    return NextResponse.json(visible);
}

/**
 * POST /api/tasks — creates a task definition and the instances that make it visible to workers.
 */
export async function POST(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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
        const task = await TaskService.createTask(validationResult.data);
        return NextResponse.json(task, { status: 201 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
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
