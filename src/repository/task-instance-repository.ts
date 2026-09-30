import { Prisma, TaskStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { toDateOnlyString } from '@/types/date-only';
import { TaskInstanceDetailView, TaskInstanceListView } from '@/types/task-instance';

/**
 * Which instances a given worker may see. A task targets either a named person or a whole role,
 * so 'this user's instances' is the union of both: tasks addressed to them personally, plus
 * tasks addressed to their role at a branch they actually work at.
 */
export interface AssignedToUserFilter {
    userId: number;
    roleId: number;
    branchIds: number[];
}

export interface TaskInstanceFilters {
    branchId?: number;
    dueDate?: Date;
    // Inclusive range, for the worker's own list (GET /users/:userId/tasks). Ignored when
    // dueDate is also given, since an exact date already answers the question a range would.
    dueFrom?: Date;
    dueTo?: Date;
    status?: TaskStatus;
    assignedToUser?: AssignedToUserFilter;
}

/** Shared by list, detail and both writes, so the response shape cannot drift between them. */
const instanceInclude = {
    task: {
        select: {
            taskId: true,
            title: true,
            description: true,
            branchId: true,
            assignedTo: true,
            assignedRoleId: true,
            branch: { select: { name: true } },
            assignee: { select: { userId: true, name: true } },
        },
    },
    media: { orderBy: { serverTimestamp: 'desc' } },
} satisfies Prisma.TaskInstanceInclude;

type InstanceWithJoins = Prisma.TaskInstanceGetPayload<{ include: typeof instanceInclude }>;

export class TaskInstanceRepository {
    /** The worker's daily list. */
    static async getTaskInstances(filters: TaskInstanceFilters = {}): Promise<TaskInstanceListView[]> {
        const instances = await db.taskInstance.findMany({
            where: TaskInstanceRepository.buildWhere(filters),
            include: { ...instanceInclude, media: { orderBy: { serverTimestamp: 'desc' }, take: 1 } },
            orderBy: [{ dueDate: 'desc' }, { instanceId: 'asc' }],
        });

        return instances.map((instance) => {
            const { media, ...rest } = TaskInstanceRepository.toView(instance);
            return { ...rest, latest_photo: media[0] ?? null };
        });
    }

    static async getTaskInstanceById(instanceId: number): Promise<TaskInstanceDetailView | null> {
        const instance = await db.taskInstance.findUnique({
            where: { instanceId },
            include: instanceInclude,
        });

        return instance ? TaskInstanceRepository.toView(instance) : null;
    }

    /** Whether the instance exists at all — no columns, just presence. */
    static async instanceExists(instanceId: number): Promise<boolean> {
        const instance = await db.taskInstance.findUnique({
            where: { instanceId },
            select: { instanceId: true },
        });

        return instance !== null;
    }

    /** Minimal read used by the service to decide permission and status before a write. */
    static async getInstanceForWrite(instanceId: number) {
        return db.taskInstance.findUnique({
            where: { instanceId },
            select: {
                instanceId: true,
                status: true,
                completedBy: true,
                task: {
                    select: {
                        taskId: true,
                        branchId: true,
                        assignedTo: true,
                        assignedRoleId: true,
                        active: true,
                    },
                },
            },
        });
    }

    /** Records a completion: the media row and the status change land together or not at all. */
    static async completeInstance(params: {
        instanceId: number;
        completedBy: number;
        filePath: string;
        completedAt: Date;
    }): Promise<TaskInstanceDetailView> {
        const { instanceId, completedBy, filePath, completedAt } = params;

        return db.$transaction(async (tx) => {
            await tx.media.create({
                data: {
                    taskInstanceId: instanceId,
                    filePath,
                    uploadedBy: completedBy,
                    serverTimestamp: completedAt,
                },
            });

            const instance = await tx.taskInstance.update({
                where: { instanceId },
                data: { status: TaskStatus.completed, completedBy, completedAt },
                include: instanceInclude,
            });

            return TaskInstanceRepository.toView(instance);
        });
    }

    static async reviewInstance(params: {
        instanceId: number;
        decision: typeof TaskStatus.verified | typeof TaskStatus.rejected;
        reviewedBy: number;
        reviewedAt: Date;
    }): Promise<TaskInstanceDetailView> {
        const { instanceId, decision, reviewedBy, reviewedAt } = params;

        const instance = await db.taskInstance.update({
            where: { instanceId },
            data: { status: decision, reviewedBy, reviewedAt },
            include: instanceInclude,
        });

        return TaskInstanceRepository.toView(instance);
    }

    /**
     * Inserts one instance per date, skipping ones that already exist (ON CONFLICT DO NOTHING on
     * UNIQUE (task_id, due_date)) — what makes the top-up job idempotent across reruns. Returns
     * how many rows were new.
     */
    static async createInstances(
        taskId: number,
        dueDates: Date[],
        client: Prisma.TransactionClient = db,
    ): Promise<number> {
        if (dueDates.length === 0) {
            return 0;
        }

        const result = await client.taskInstance.createMany({
            data: dueDates.map((dueDate) => ({ taskId, dueDate })),
            skipDuplicates: true,
        });

        return result.count;
    }

    /**
     * Removes pending instances of deactivated *recurring* tasks — cancelled work the per-task
     * diff never visits (inactive tasks are absent from getActiveRecurringTasks). Pending-only, so
     * nothing with a photo, completer or review decision is touched. Recurring-only is load-bearing:
     * deleting is safe because the insert pass regenerates the window on reactivation, but a
     * one-off's single instance is never recreated, so deleting it would strand the task with none.
     * One-off cancellation instead relies on the inactive-gated read filter and completion guard.
     * Returns how many rows were removed.
     */
    static async deleteCancelledPendingInstances(): Promise<number> {
        const result = await db.taskInstance.deleteMany({
            where: {
                status: TaskStatus.pending,
                task: { isRecurring: true, active: false },
            },
        });

        return result.count;
    }

    /**
     * The task's own pending instances from `from` onwards, for the reconcile diff. Bounded there
     * deliberately: rows before `from` are overdue work-not-done, and the diff must never be able
     * to delete that record.
     */
    static async getPendingInstancesFrom(
        taskId: number,
        from: Date,
    ): Promise<{ instanceId: number; dueDate: Date }[]> {
        return db.taskInstance.findMany({
            where: { taskId, status: TaskStatus.pending, dueDate: { gte: from } },
            select: { instanceId: true, dueDate: true },
            orderBy: { dueDate: 'asc' },
        });
    }

    /**
     * Deletes the given instances, re-asserting `pending` at delete time: a completion landing
     * between the diff's read and this write would otherwise lose its photo.
     */
    static async deletePendingInstancesByIds(instanceIds: number[]): Promise<number> {
        if (instanceIds.length === 0) {
            return 0;
        }

        const result = await db.taskInstance.deleteMany({
            where: { instanceId: { in: instanceIds }, status: TaskStatus.pending },
        });

        return result.count;
    }
    private static buildWhere(filters: TaskInstanceFilters): Prisma.TaskInstanceWhereInput {
        const { branchId, dueDate, dueFrom, dueTo, status, assignedToUser } = filters;

        const task: Prisma.TaskWhereInput = {};

        if (branchId !== undefined) {
            task.branchId = branchId;
        }

        if (assignedToUser) {
            task.OR = [
                { assignedTo: assignedToUser.userId },
                { assignedRoleId: assignedToUser.roleId, branchId: { in: assignedToUser.branchIds } },
            ];
        }

        return {
            dueDate: dueDate ?? (dueFrom !== undefined || dueTo !== undefined
                ? { gte: dueFrom, lte: dueTo }
                : undefined),
            status,
            ...(Object.keys(task).length > 0 ? { task } : {}),
            // A deactivated task's outstanding work is cancelled, so its pending instances drop
            // out of the list. Anything already completed stays: the photo and the sign-off are
            // the record of work that did happen, and a flag flipped today cannot unmake that.
            OR: [
                { status: { not: TaskStatus.pending } },
                { task: { active: true } },
            ],
        };
    }
    private static toView(instance: InstanceWithJoins): TaskInstanceDetailView {
        return {
            instance_id: instance.instanceId,
            task_id: instance.taskId,
            due_date: toDateOnlyString(instance.dueDate),
            status: instance.status,
            completed_by: instance.completedBy,
            completed_at: instance.completedAt,
            reviewed_by: instance.reviewedBy,
            reviewed_at: instance.reviewedAt,
            task: {
                task_id: instance.task.taskId,
                title: instance.task.title,
                description: instance.task.description,
                branch_id: instance.task.branchId,
                branch_name: instance.task.branch.name,
                assigned_to: instance.task.assignedTo,
                assigned_role_id: instance.task.assignedRoleId,
            },
            assignee: instance.task.assignee
                ? { user_id: instance.task.assignee.userId, name: instance.task.assignee.name }
                : null,
            media: instance.media.map((media) => ({
                media_id: media.mediaId,
                file_path: media.filePath,
                uploaded_by: media.uploadedBy,
                server_timestamp: media.serverTimestamp,
            })),
        };
    }
}
