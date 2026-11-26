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
import { InvalidTaskReferenceError } from "@/exceptions/invalid-task-reference-error";
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

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
        logger.error({ err: error }, 'Failed to fetch tasks');
        return internalErrorResponse('Failed to fetch tasks');
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
        return invalidJsonResponse()
    }

    const validationResult = CreateTaskSchema.safeParse(body);

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
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
            error instanceof InvalidRecurrenceError ||
            error instanceof InvalidTaskReferenceError
        ) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to create task')
        return internalErrorResponse('Failed to create task')
    }
}
