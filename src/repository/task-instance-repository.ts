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

    /** Minimal read used by the service to decide permission and status before a write. */
    static async getInstanceForWrite(instanceId: number) {
        return db.taskInstance.findUnique({
            where: { instanceId },
            select: {
                instanceId: true,
                status: true,
                completedBy: true,
                task: {
                    select: { taskId: true, branchId: true, assignedTo: true, assignedRoleId: true },
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
