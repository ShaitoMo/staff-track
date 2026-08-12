import { Prisma } from "@prisma/client";
import { CreateTaskInput, Task, UpdateTaskInput } from "../types/task";
import { db } from "@/lib/db";
import { TaskInstanceRepository } from "@/repository/task-instance-repository";
import { TaskNotFoundError } from "@/exceptions/task-not-found-error";
import { InvalidTaskAssignmentError } from "@/exceptions/invalid-task-assignment-error";

export class TasksRepository {
    static async getAllTasks(): Promise<Task[]> {
        const tasks = await db.task.findMany();
        return tasks.map(TasksRepository.toTask);
    }

    /**
     * Creates a task and its instances atomically: a task whose instance insert failed would be
     * invisible to every worker, since workers only ever see instances.
     */
    static async createTask(data: CreateTaskInput, dueDates: Date[]): Promise<Task> {
        try {
            return await db.$transaction(async (tx) => {
                const task = await tx.task.create({
                    data: {
                        title: data.title,
                        description: data.description ?? null,
                        branchId: data.branch_id,
                        assignedTo: data.assigned_to ?? null,
                        assignedRoleId: data.assigned_role_id ?? null,
                        assignedBy: data.assigned_by,
                        origin: data.origin,
                        isRecurring: data.is_recurring,
                        recurrence: data.recurrence ?? null,
                    },
                });

                await TaskInstanceRepository.createInstances(task.taskId, dueDates, tx);

                return TasksRepository.toTask(task);
            });
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                throw new InvalidTaskAssignmentError()
            }
            throw error
        }
    }

    /** Recurring tasks the top-up job should keep stocked with instances. */
    static async getActiveRecurringTasks(): Promise<Task[]> {
        const tasks = await db.task.findMany({
            where: { active: true, isRecurring: true, recurrence: { not: null } },
            orderBy: { taskId: 'asc' },
        });

        return tasks.map(TasksRepository.toTask);
    }

    static async getTaskById(taskId: number): Promise<Task | null> {
        const task = await db.task.findUnique({
            where: { taskId },
        });

        return task ? TasksRepository.toTask(task) : null;
    }

    static async updateTask(taskId: number, data: UpdateTaskInput): Promise<Task> {
        try {
            const task = await db.task.update({
                where: { taskId },
                data: {
                    title: data.title,
                    description: data.description,
                    assignedTo: data.assigned_to,
                    assignedRoleId: data.assigned_role_id,
                    isRecurring: data.is_recurring,
                    recurrence: data.recurrence,
                    active: data.active,
                },
            });

            return TasksRepository.toTask(task);
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new TaskNotFoundError()
                }
                if (error.code === 'P2003') {
                    throw new InvalidTaskAssignmentError()
                }
            }
            throw error
        }
    }

    private static toTask(task: {
        taskId: number;
        title: string;
        description: string | null;
        branchId: number;
        assignedTo: number | null;
        assignedRoleId: number | null;
        assignedBy: number;
        origin: string;
        isRecurring: boolean;
        recurrence: string | null;
        active: boolean;
        createdAt: Date;
    }): Task {
        return {
            task_id: task.taskId,
            title: task.title,
            description: task.description,
            branch_id: task.branchId,
            assigned_to: task.assignedTo,
            assigned_role_id: task.assignedRoleId,
            assigned_by: task.assignedBy,
            origin: task.origin,
            is_recurring: task.isRecurring,
            recurrence: task.recurrence,
            active: task.active,
            created_at: task.createdAt,
        };
    }
}