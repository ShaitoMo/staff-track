import { TasksRepository } from '../repository/tasks-repository';
import { TaskInstanceRepository } from '@/repository/task-instance-repository';
import { UserBranchRepository } from '@/repository/user-branch-repository';
import { BranchRepository } from '@/repository/branch-repository';
import { RoleRepository } from '@/repository/role-repository';
import {
    addDays,
    getDates,
    isValidRecurrence,
    surplusInstanceIds,
    WINDOW_DAYS,
} from '@/lib/recurrence';
import { machineDayOf } from '@/lib/machine-time';
import { CreateTaskInput, Task, UpdateTaskInput } from '../types/task';
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error';
import { logger } from '@/lib/logger';
import { RoleNotFoundError } from '@/exceptions/role-not-found-error';
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error';
import { TaskNotFoundError } from '@/exceptions/task-not-found-error';
import { InvalidTaskAssignmentError } from '@/exceptions/invalid-task-assignment-error';
import { InvalidScheduleChangeError } from '@/exceptions/invalid-schedule-change-error';

export class TaskService {

    static async getAllTasks(): Promise<Task[]> {
        return TasksRepository.getAllTasks();
    }

    static async getTaskById(taskId: number): Promise<Task | null> {
        return TasksRepository.getTaskById(taskId);
    }

    /**
     * Updates a task, then reconciles its forward instances to the new definition — deactivating
     * or narrowing a schedule would otherwise leave stale rows until the next daily job run.
     * `is_recurring` is immutable (see InvalidScheduleChangeError).
     */
    static async updateTask(taskId: number, data: UpdateTaskInput): Promise<Task> {
        const before = await TasksRepository.getTaskById(taskId);

        if (!before) {
            throw new TaskNotFoundError();
        }

        // UpdateTaskSchema settles whether the requested pair is coherent; only the stored task
        // can say whether it is a change at all, so this one lives here rather than there.
        // Restating the current value is not a change and is allowed.
        if (data.is_recurring !== undefined && data.is_recurring !== before.is_recurring) {
            throw new InvalidScheduleChangeError();
        }

        if (data.assigned_to !== undefined || data.assigned_role_id !== undefined) {
            await TaskService.assertAssignmentIsValid(before, data);
        }

        const after = await TasksRepository.updateTask(taskId, data);

        // `is_recurring` is immutable above, so the two sides always agree on the task's kind and
        // only these two fields can have moved.
        const scheduleChanged =
            before.active !== after.active || before.recurrence !== after.recurrence;

        // A title or description edit cannot invalidate an instance, so it does no instance work.
        // Neither can any edit to a one-off: its single instance is authored, never generated.
        if (scheduleChanged && after.is_recurring) {
            await TaskService.syncGeneratedInstances(after);
        }

        return after;
    }

    /**
     * Reconciles one recurring task's forward instances against its own definition — the same
     * insert-then-prune the daily job applies, narrowed to one task. Deleting is safe because a
     * recurring task's instances always regenerate from its rule.
     */
    private static async syncGeneratedInstances(task: Task, today = new Date()): Promise<void> {
        const from = machineDayOf(today);
        const to = addDays(from, WINDOW_DAYS);

        const generates = task.active && task.is_recurring && task.recurrence !== null;

        // An unexpandable rule means 'unknown', not 'nothing'. Treating it as nothing would delete
        // the task's whole forward window on the strength of a typo, so leave the rows alone and
        // let the next edit — or a corrected rule — settle it.
        if (generates && !isValidRecurrence(task.recurrence as string)) {
            logger.warn(
                { taskId: task.task_id, recurrence: task.recurrence },
                'Task was updated to an unparseable recurrence; instances left as they are',
            );
            return;
        }

        const dates = generates ? getDates(task.recurrence as string, from, to) : [];

        if (dates.length > 0) {
            await TaskInstanceRepository.createInstances(task.task_id, dates);
        }

        await TaskService.pruneSurplus(task.task_id, dates, from);
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
     * Brings the instance table in line with active recurring tasks: insert+prune per task (a
     * narrowed rule needs the prune, since no insert pass removes rows on its own), then one sweep
     * for tasks deactivated since the last run. One-off instances are never touched. Idempotent,
     * so this repairs whatever a missed run left behind; `updateTask` does the same reconciliation
     * immediately on a live edit.
     */
    static async reconcileInstances(
        today = new Date(),
    ): Promise<{ tasks: number; created: number; deleted: number }> {
        const from = machineDayOf(today);

        // Backdating would be destructive rather than merely wrong: with `from` in the past, the
        // window closes before most forward rows, and the diff reports all of them as surplus.
        // The parameter is here to make a run deterministic, not to replay an earlier day.
        if (from.getTime() < machineDayOf(new Date()).getTime()) {
            throw new RangeError(
                'reconcileInstances cannot run against a past date: the prune would delete instances that are still due',
            );
        }

        const to = addDays(from, WINDOW_DAYS);
        const tasks = await TasksRepository.getActiveRecurringTasks();

        let created = 0;
        let deleted = 0;

        for (const task of tasks) {
            // a rule that no longer parses must not stop the other tasks from being reconciled,
            // and must not reach the diff: 'cannot expand' would read there as 'expects nothing'
            let dates: Date[];
            try {
                dates = getDates(task.recurrence as string, from, to);
            } catch {
                logger.warn(
                    { taskId: task.task_id, recurrence: task.recurrence },
                    'Task has an unparseable recurrence; skipping',
                );
                continue;
            }

            created += await TaskInstanceRepository.createInstances(task.task_id, dates);
            deleted += await TaskService.pruneSurplus(task.task_id, dates, from);
        }

        deleted += await TaskInstanceRepository.deleteCancelledPendingInstances();

        return { tasks: tasks.length, created, deleted };
    }

    /** Deletes the task's forward pending rows that `dates` does not account for. */
    private static async pruneSurplus(
        taskId: number,
        dates: Date[],
        from: Date,
    ): Promise<number> {
        const pending = await TaskInstanceRepository.getPendingInstancesFrom(taskId, from);

        return TaskInstanceRepository.deletePendingInstancesByIds(
            surplusInstanceIds(dates, pending),
        );
    }

    /** One-off: a single instance. Recurring: every date the rule lands on in the window. */
    private static instanceDatesFor(data: CreateTaskInput): Date[] {
        if (!data.is_recurring) {
            // guaranteed present by CreateTaskSchema for a one-off task
            return [data.due_date as Date];
        }

        const from = machineDayOf(new Date());

        return getDates(data.recurrence as string, from, addDays(from, WINDOW_DAYS));
    }

    /**
     * Re-checks createTask's assignment rules against the *effective* result of a PATCH: a field
     * left out of the request keeps the task's current value, so the check runs against the
     * merged state rather than the raw patch.
     */
    private static async assertAssignmentIsValid(before: Task, data: UpdateTaskInput): Promise<void> {
        const assignedTo = data.assigned_to !== undefined ? data.assigned_to : before.assigned_to;
        const assignedRoleId =
            data.assigned_role_id !== undefined ? data.assigned_role_id : before.assigned_role_id;

        const hasAssignee = assignedTo !== null;
        const hasRole = assignedRoleId !== null;

        if (hasAssignee === hasRole) {
            throw new InvalidTaskAssignmentError();
        }

        if (hasAssignee) {
            const links = await UserBranchRepository.getUserBranches({
                userId: assignedTo as number,
                branchId: before.branch_id,
            });

            if (links.length === 0) {
                throw new UserNotAtBranchError();
            }

            return;
        }

        const role = await RoleRepository.getRoleById(assignedRoleId as number);

        if (!role) {
            throw new RoleNotFoundError();
        }
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

        const role = await RoleRepository.getRoleById(data.assigned_role_id as number);

        if (!role) {
            throw new RoleNotFoundError();
        }
    }
}
