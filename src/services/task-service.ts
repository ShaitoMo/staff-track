import { TasksRepository } from '../repository/tasks-repository';
import { TaskInstanceRepository } from '@/repository/task-instance-repository';
import { UserBranchRepository } from '@/repository/user-branch-repository';
import { BranchRepository } from '@/repository/branch-repository';
import { RolesRepository } from '@/repository/role-repository';
import { addDays, getDates, toUtcDate, WINDOW_DAYS } from '@/lib/recurrence';
import { CreateTaskInput, Task, UpdateTaskInput } from '../types/task';
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error';
import { RoleNotFoundError } from '@/exceptions/role-not-found-error';
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error';

export class TaskService {

    static async getAllTasks(): Promise<Task[]> {
        return TasksRepository.getAllTasks();
    }

    static async getTaskById(taskId: number): Promise<Task | null> {
        return TasksRepository.getTaskById(taskId);
    }

    static async updateTask(taskId: number, data: UpdateTaskInput): Promise<Task> {
        return TasksRepository.updateTask(taskId, data);
    }

    /**
     * Creates a task together with the instances that make it visible.
     *
     * A one-off gets exactly one instance on its due date; a recurring task gets every date its
     * rule lands on in [today, today + WINDOW_DAYS]. The daily job extends the window from there.
     */
    static async createTask(data: CreateTaskInput): Promise<Task> {
        await TaskService.assertBranchExists(data.branch_id);
        await TaskService.assertTargetIsValid(data);

        const dueDates = TaskService.instanceDatesFor(data);

        return TasksRepository.createTask(data, dueDates);
    }

    /**
     * Extends the instance window for every active recurring task. Safe to run repeatedly:
     * inserts go through ON CONFLICT DO NOTHING, so only genuinely new dates take effect.
     */
    static async topUpRecurringInstances(today = new Date()): Promise<{ tasks: number; created: number }> {
        const tasks = await TasksRepository.getActiveRecurringTasks();

        const from = toUtcDate(today);
        const to = addDays(from, WINDOW_DAYS);

        let created = 0;

        for (const task of tasks) {
            // a rule that no longer parses must not stop the other tasks from being topped up
            let dates: Date[];
            try {
                dates = getDates(task.recurrence as string, from, to);
            } catch {
                console.error(
                    `Task ${task.task_id} has an unparseable recurrence '${task.recurrence}'; skipping`,
                );
                continue;
            }

            created += await TaskInstanceRepository.createInstances(task.task_id, dates);
        }

        return { tasks: tasks.length, created };
    }

    /** One-off: a single instance. Recurring: every date the rule lands on in the window. */
    private static instanceDatesFor(data: CreateTaskInput): Date[] {
        if (!data.is_recurring) {
            // guaranteed present by CreateTaskSchema for a one-off task
            return [data.due_date as Date];
        }

        const from = toUtcDate(new Date());

        return getDates(data.recurrence as string, from, addDays(from, WINDOW_DAYS));
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId);

        if (!branch) {
            throw new BranchNotFoundError();
        }
    }

    /**
     * The task targets either a person or a role (CreateTaskSchema guarantees exactly one).
     * A named assignee has to actually work at the branch, or the task can never be done.
     */
    private static async assertTargetIsValid(data: CreateTaskInput): Promise<void> {
        if (data.assigned_to !== null && data.assigned_to !== undefined) {
            const links = await UserBranchRepository.getUserBranches({
                userId: data.assigned_to,
                branchId: data.branch_id,
            });

            if (links.length === 0) {
                throw new UserNotAtBranchError();
            }

            return;
        }

        const role = await RolesRepository.getRoleById(data.assigned_role_id as number);

        if (!role) {
            throw new RoleNotFoundError();
        }
    }
}
