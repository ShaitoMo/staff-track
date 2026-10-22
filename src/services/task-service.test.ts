jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/tasks-repository', () => ({
    TasksRepository: { getTaskById: jest.fn(), updateTask: jest.fn(), createTask: jest.fn() },
}));
jest.mock('@/repository/task-instance-repository', () => ({
    TaskInstanceRepository: {
        createInstances: jest.fn(),
        getPendingInstancesFrom: jest.fn(),
        deletePendingInstancesByIds: jest.fn(),
    },
}));
jest.mock('@/repository/user-branch-repository', () => ({
    UserBranchRepository: { getUserBranches: jest.fn() },
}));
jest.mock('@/repository/branch-repository', () => ({
    BranchRepository: { assertExists: jest.fn() },
}));
jest.mock('@/repository/branch-section-repository', () => ({
    BranchSectionRepository: { getSectionById: jest.fn() },
}));
jest.mock('@/repository/guide-folder-repository', () => ({
    GuideFolderRepository: { getFolderById: jest.fn() },
}));
jest.mock('@/repository/role-repository', () => ({
    RoleRepository: { getRoleById: jest.fn() },
}));

import { TaskService } from '@/services/task-service';
import { TasksRepository } from '@/repository/tasks-repository';
import { TaskInstanceRepository } from '@/repository/task-instance-repository';
import { UserBranchRepository } from '@/repository/user-branch-repository';
import { RoleRepository } from '@/repository/role-repository';
import { CreateTaskInput, Task, UpdateTaskInput } from '@/types/task';
import { BranchSectionView } from '@/types/shelf-guide';
import { BranchSectionRepository } from '@/repository/branch-section-repository';
import { GuideFolderRepository } from '@/repository/guide-folder-repository';
import { InvalidTaskReferenceError } from '@/exceptions/invalid-task-reference-error';
import { InvalidScheduleChangeError } from '@/exceptions/invalid-schedule-change-error';
import { InvalidTaskAssignmentError } from '@/exceptions/invalid-task-assignment-error';
import { TaskNotFoundError } from '@/exceptions/task-not-found-error';
import { RoleNotFoundError } from '@/exceptions/role-not-found-error';
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error';

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
const getUserBranches = UserBranchRepository.getUserBranches as jest.MockedFunction<
    typeof UserBranchRepository.getUserBranches
>;
const getRoleById = RoleRepository.getRoleById as jest.MockedFunction<
    typeof RoleRepository.getRoleById
>;

const TASK_ID = 10;
const BRANCH_ID = 1;

function task(overrides: Partial<Task> = {}): Task {
    return {
        task_id: TASK_ID,
        title: 'Check the fridge',
        description: null,
        branch_id: BRANCH_ID,
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

describe('updateTask — re-checks the assignment rules createTask enforces', () => {
    it('leaves assignment alone, and untouched, when the patch does not mention it', async () => {
        await patch(task({ assigned_to: 2, assigned_role_id: null }), { title: 'Wipe the counters' });

        expect(getUserBranches).not.toHaveBeenCalled();
        expect(getRoleById).not.toHaveBeenCalled();
    });

    it('rejects a patch that would leave both assigned_to and assigned_role_id set', async () => {
        await expect(
            patch(task({ assigned_to: 2, assigned_role_id: null }), { assigned_role_id: 5 }),
        ).rejects.toThrow(InvalidTaskAssignmentError);
    });

    it('rejects a patch that would leave neither assigned_to nor assigned_role_id set', async () => {
        await expect(
            patch(task({ assigned_to: 2, assigned_role_id: null }), { assigned_to: null }),
        ).rejects.toThrow(InvalidTaskAssignmentError);
    });

    it('rejects reassigning to someone who does not work at the branch', async () => {
        getUserBranches.mockResolvedValue([]);

        await expect(
            patch(task({ assigned_to: 2, assigned_role_id: null }), { assigned_to: 9 }),
        ).rejects.toThrow(UserNotAtBranchError);

        expect(getUserBranches).toHaveBeenCalledWith({ userId: 9, branchId: BRANCH_ID });
    });

    it('accepts reassigning to someone who works at the branch', async () => {
        getUserBranches.mockResolvedValue([{ userId: 9, branchId: BRANCH_ID }]);

        await expect(
            patch(task({ assigned_to: 2, assigned_role_id: null }), { assigned_to: 9 }),
        ).resolves.toBeDefined();
    });

    it('rejects retargeting to a role that does not exist', async () => {
        getRoleById.mockResolvedValue(null);

        await expect(
            patch(task({ assigned_to: 2, assigned_role_id: null }), {
                assigned_to: null,
                assigned_role_id: 99,
            }),
        ).rejects.toThrow(RoleNotFoundError);
    });

    it('accepts retargeting to a role that exists', async () => {
        getRoleById.mockResolvedValue({ roleId: 99, name: 'cashier' });

        await expect(
            patch(task({ assigned_to: 2, assigned_role_id: null }), {
                assigned_to: null,
                assigned_role_id: 99,
            }),
        ).resolves.toBeDefined();
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

describe('createTask — the shelf-guide reference must be live at the task\'s branch', () => {
    const getSectionById = BranchSectionRepository.getSectionById as jest.Mock;
    const getFolderById = GuideFolderRepository.getFolderById as jest.Mock;
    const createTask = TasksRepository.createTask as jest.Mock;

    const section = (overrides: Partial<BranchSectionView> = {}): BranchSectionView => ({
        branchSectionId: 4, branchId: BRANCH_ID, branchName: 'Hamra', sectionTypeId: 2, name: 'Dairy fridge', displayOrder: 0, isActive: true,
        ...overrides,
    });
    const folder = (branchSectionId = 4, isActive = true) => ({ view: { folderId: 9, branchSectionId, isActive } });

    const input = (reference: Partial<CreateTaskInput> = {}): CreateTaskInput => ({
        title: 'Face up the yoghurts',
        branch_id: BRANCH_ID,
        assigned_to: 2,
        origin: 'assigned',
        is_recurring: false,
        due_date: new Date('2026-11-01T00:00:00Z'),
        assigned_by: 3,
        ...reference,
    });

    beforeEach(() => {
        getUserBranches.mockResolvedValue([{ userId: 2, branchId: BRANCH_ID }] as never);
        createTask.mockResolvedValue(task());
    });

    it('creates a task with no reference without looking one up', async () => {
        await TaskService.createTask(input());

        expect(getSectionById).not.toHaveBeenCalled();
        expect(createTask).toHaveBeenCalled();
    });

    it('accepts an active section at the branch, and an active folder in it', async () => {
        getSectionById.mockResolvedValue(section());
        getFolderById.mockResolvedValue(folder());

        await TaskService.createTask(input({ branch_section_id: 4, guide_folder_id: 9 }));

        expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ branch_section_id: 4, guide_folder_id: 9 }), expect.any(Array));
    });

    it.each([
        ['missing', null],
        ["another branch's", section({ branchId: 2 })],
        ['an inactive', section({ isActive: false })],
    ])('refuses %s section', async (_label, found) => {
        getSectionById.mockResolvedValue(found);

        await expect(TaskService.createTask(input({ branch_section_id: 4 }))).rejects.toThrow(InvalidTaskReferenceError);
        expect(createTask).not.toHaveBeenCalled();
    });

    it.each([
        ['missing', null],
        ["another section's", folder(5)],
        ['an inactive', folder(4, false)],
    ])('refuses %s folder', async (_label, found) => {
        getSectionById.mockResolvedValue(section());
        getFolderById.mockResolvedValue(found);

        await expect(TaskService.createTask(input({ branch_section_id: 4, guide_folder_id: 9 }))).rejects.toThrow(InvalidTaskReferenceError);
        expect(createTask).not.toHaveBeenCalled();
    });
});
