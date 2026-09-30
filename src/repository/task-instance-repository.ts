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
     * Inserts one instance per date, ignoring dates that already have one.
     *
     * `skipDuplicates` issues ON CONFLICT DO NOTHING against UNIQUE (task_id, due_date), which is
     * what makes generation idempotent: the top-up job re-inserts the same window every run and
     * only genuinely new dates take effect. Returns how many rows were new.
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
     * Removes the pending instances of deactivated *recurring* tasks — work that is cancelled.
     *
     * Only `pending` rows are eligible, so nothing carrying a photo, a completer or a review
     * decision can be reached. Returns how many rows were removed.
     *
     * This covers the tasks the per-task diff never visits: an inactive task is absent from
     * `getActiveRecurringTasks`, so the reconcile loop skips it and something has to sweep up
     * behind it. Everything a *live* rule fails to justify is the diff's job, not this one's.
     *
     * Recurring only, and that restriction is load-bearing rather than cautious. Deleting here is
     * safe precisely because the insert pass regenerates the window on the next run, so a
     * reactivated recurring task gets its instances back. A one-off has no such pass — its single
     * instance is authored at task creation and never recreated — so pruning one would strand the
     * task forever: it would exist with no instance, and workers only ever see instances.
     * One-off cancellation is handled without deleting anything, by the read filter (hidden while
     * inactive) and the completion guard (refused while inactive), both of which simply stop
     * applying if the task is switched back on.
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
     * The task's own pending instances from `from` onwards, for the reconcile diff.
     *
     * Bounded at `from` deliberately: rows before it are overdue work that was assigned and not
     * done, and that record is the point of the system. The diff must never be in a position to
     * delete them, so they are not fetched.
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
        const { branchId, dueDate, status, assignedToUser } = filters;

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
            dueDate,
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
