jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/tasks-repository', () => ({
    TasksRepository: { getTaskById: jest.fn(), updateTask: jest.fn() },
}));
jest.mock('@/repository/task-instance-repository', () => ({
    TaskInstanceRepository: {
        createInstances: jest.fn(),
        getPendingInstancesFrom: jest.fn(),
        deletePendingInstancesByIds: jest.fn(),
    },
}));

import { TaskService } from '@/services/task-service';
import { TasksRepository } from '@/repository/tasks-repository';
import { TaskInstanceRepository } from '@/repository/task-instance-repository';
import { Task, UpdateTaskInput } from '@/types/task';
import { InvalidScheduleChangeError } from '@/exceptions/invalid-schedule-change-error';
import { TaskNotFoundError } from '@/exceptions/task-not-found-error';

const getTaskById = TasksRepository.getTaskById as jest.MockedFunction<
    typeof TasksRepository.getTaskById
>;
const updateTask = TasksRepository.updateTask as jest.MockedFunction<
    typeof TasksRepository.updateTask
>;
const createInstances = TaskInstanceRepository.createInstances as jest.MockedFunction<
    typeof TaskInstanceRepository.createInstances
>;
const getPendingInstancesFrom =
    TaskInstanceRepository.getPendingInstancesFrom as jest.MockedFunction<
        typeof TaskInstanceRepository.getPendingInstancesFrom
    >;

const TASK_ID = 10;

function task(overrides: Partial<Task> = {}): Task {
    return {
        task_id: TASK_ID,
        title: 'Check the fridge',
        description: null,
        branch_id: 1,
        assigned_to: 2,
        assigned_role_id: null,
        assigned_by: 3,
        origin: 'assigned',
        is_recurring: true,
        recurrence: 'daily',
        active: true,
        created_at: new Date('2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

/** Stages a stored task and the row the update would return, then runs the patch. */
function patch(stored: Task, data: UpdateTaskInput, result: Task = { ...stored, ...data } as Task) {
    getTaskById.mockResolvedValue(stored);
    updateTask.mockResolvedValue(result);

    return TaskService.updateTask(TASK_ID, data);
}

beforeEach(() => {
    jest.resetAllMocks();
    createInstances.mockResolvedValue(0);
    getPendingInstancesFrom.mockResolvedValue([]);
});

describe("updateTask — a task's kind is fixed at creation", () => {
    it('refuses turning a recurring task into a one-off', async () => {
        await expect(
            patch(task({ is_recurring: true }), { is_recurring: false, recurrence: null }),
        ).rejects.toThrow(InvalidScheduleChangeError);
    });

    it('refuses turning a one-off into a recurring task', async () => {
        await expect(
            patch(task({ is_recurring: false, recurrence: null }), {
                is_recurring: true,
                recurrence: 'daily',
            }),
        ).rejects.toThrow(InvalidScheduleChangeError);
    });

    it('refuses before writing anything, so the task is left as it was', async () => {
        await expect(
            patch(task({ is_recurring: true }), { is_recurring: false, recurrence: null }),
        ).rejects.toThrow(InvalidScheduleChangeError);

        expect(updateTask).not.toHaveBeenCalled();
        expect(createInstances).not.toHaveBeenCalled();
    });

    it('tells the caller to create a new task rather than leaving them to guess', async () => {
        await expect(
            patch(task({ is_recurring: true }), { is_recurring: false, recurrence: null }),
        ).rejects.toThrow(/create a new task/i);
    });

    it('allows a body that restates the current kind, which changes nothing', async () => {
        await expect(
            patch(task({ is_recurring: true, recurrence: 'daily' }), {
                is_recurring: true,
                recurrence: 'daily',
            }),
        ).resolves.toMatchObject({ is_recurring: true });
    });

    it('leaves a patch that never mentions is_recurring alone', async () => {
        await expect(
            patch(task({ is_recurring: true }), { title: 'Wipe the counters' }),
        ).resolves.toMatchObject({ title: 'Wipe the counters' });
    });
});

describe('updateTask — rule edits on a recurring task still go through', () => {
    it('accepts a narrowed rule and reconciles the instances', async () => {
        const stored = task({ is_recurring: true, recurrence: 'daily' });

        await expect(
            patch(stored, { is_recurring: true, recurrence: 'weekly:mon' }),
        ).resolves.toMatchObject({ recurrence: 'weekly:mon' });

        // the new rule is inserted and the rows it no longer covers are looked up for pruning
        expect(createInstances).toHaveBeenCalledWith(TASK_ID, expect.any(Array));
        expect(getPendingInstancesFrom).toHaveBeenCalledWith(TASK_ID, expect.any(Date));
    });

    it('accepts a widened rule', async () => {
        const stored = task({ recurrence: 'weekly:mon' });

        await expect(
            patch(stored, { is_recurring: true, recurrence: 'daily' }),
        ).resolves.toMatchObject({ recurrence: 'daily' });

        expect(createInstances).toHaveBeenCalled();
    });

    it('reconciles when a recurring task is deactivated', async () => {
        const stored = task({ active: true });

        await patch(stored, { active: false });

        // nothing to generate, so the surplus lookup is the whole of the work
        expect(getPendingInstancesFrom).toHaveBeenCalledWith(TASK_ID, expect.any(Date));
        expect(createInstances).not.toHaveBeenCalled();
    });

    it('does no instance work for an edit that cannot invalidate one', async () => {
        await patch(task(), { title: 'Wipe the counters' });

        expect(createInstances).not.toHaveBeenCalled();
        expect(getPendingInstancesFrom).not.toHaveBeenCalled();
    });

    it('does no instance work when a one-off is deactivated, whose instance was authored', async () => {
        const stored = task({ is_recurring: false, recurrence: null });

        await patch(stored, { active: false });

        expect(createInstances).not.toHaveBeenCalled();
        expect(getPendingInstancesFrom).not.toHaveBeenCalled();
    });
});

describe('updateTask — missing task', () => {
    it('reports a 404-shaped error without attempting the write', async () => {
        getTaskById.mockResolvedValue(null);

        await expect(TaskService.updateTask(TASK_ID, { title: 'x' })).rejects.toThrow(
            TaskNotFoundError,
        );

        expect(updateTask).not.toHaveBeenCalled();
    });
});
