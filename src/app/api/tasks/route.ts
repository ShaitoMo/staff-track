import { NextRequest, NextResponse } from "next/server";
import { TaskService } from "@/services/task-service";
import { CreateTaskSchema } from "@/types/task";
import { BranchNotFoundError } from "@/exceptions/branch-not-found-error";
import { RoleNotFoundError } from "@/exceptions/role-not-found-error";
import { UserNotAtBranchError } from "@/exceptions/user-not-at-branch-error";
import { InvalidTaskAssignmentError } from "@/exceptions/invalid-task-assignment-error";
import { InvalidRecurrenceError } from "@/exceptions/invalid-recurrence-error";

export async function GET() {
    try {
        const tasks = await TaskService.getAllTasks();
        return NextResponse.json(tasks, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
}

/**
 * POST /api/tasks — creates a task definition and the instances that make it visible to workers.
 */
export async function POST(req: NextRequest) {
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
        const task = await TaskService.createTask(validationResult.data);
        return NextResponse.json(task, { status: 201 })
    } catch (error) {
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
