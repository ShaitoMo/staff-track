import { TaskStatus } from '@prisma/client';

jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/repository/user-repository', () => ({
    UserRepository: { getUserById: jest.fn() },
}));
jest.mock('@/repository/user-branch-repository', () => ({
    UserBranchRepository: { getUserBranches: jest.fn() },
}));
jest.mock('@/repository/task-instance-repository', () => ({
    TaskInstanceRepository: { getInstanceForWrite: jest.fn(), reviewInstance: jest.fn() },
}));
jest.mock('@/repository/role-repository', () => ({
    RoleRepository: { getRoleById: jest.fn() },
}));

import { TaskInstanceService } from '@/services/task-instance-service';
import { UserRepository } from '@/repository/user-repository';
import { UserBranchRepository } from '@/repository/user-branch-repository';
import { TaskInstanceRepository } from '@/repository/task-instance-repository';
import { RoleRepository } from '@/repository/role-repository';
import { InactiveTaskError } from '@/exceptions/inactive-task-error';
import { ForbiddenError, NotAssignedToTaskError, NotBranchManagerError } from '@/exceptions/forbidden-error';

const getUserById = UserRepository.getUserById as jest.MockedFunction<
    typeof UserRepository.getUserById
>;
const getUserBranches = UserBranchRepository.getUserBranches as jest.MockedFunction<
    typeof UserBranchRepository.getUserBranches
>;
const getInstanceForWrite = TaskInstanceRepository.getInstanceForWrite as jest.MockedFunction<
    typeof TaskInstanceRepository.getInstanceForWrite
>;
const getRoleById = RoleRepository.getRoleById as jest.MockedFunction<
    typeof RoleRepository.getRoleById
>;

const ASSIGNEE = 7;
const OTHER_USER = 8;
const ROLE = 2;
const MANAGER_ROLE = 1;
const BRANCH = 3;

/** Mirrors the `getInstanceForWrite` projection: exactly what the permission rules get to see. */
function instance(task: {
    assignedTo?: number | null;
    assignedRoleId?: number | null;
    active?: boolean;
}) {
    return {
        instanceId: 1,
        status: TaskStatus.pending,
        completedBy: null,
        task: {
            taskId: 10,
            branchId: BRANCH,
            assignedTo: task.assignedTo ?? null,
            assignedRoleId: task.assignedRoleId ?? null,
            active: task.active ?? true,
        },
    };
}

function user(overrides: { userId?: number; roleId?: number; isActive?: boolean } = {}) {
    return {
        userId: overrides.userId ?? ASSIGNEE,
        name: 'Test User',
        phone: '0000',
        roleId: overrides.roleId ?? ROLE,
        isActive: overrides.isActive ?? true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
    };
}

const atBranch = [{ userId: ASSIGNEE, branchId: BRANCH }];

/** `assertMayComplete` is private; element access reaches it without widening the service API. */
const assertMayComplete = (
    forWrite: ReturnType<typeof instance>,
    completedBy: number,
): Promise<void> => TaskInstanceService['assertMayComplete'](forWrite, completedBy);

/** `assertMayReview` is private; element access reaches it without widening the service API. */
const assertMayReview = (userId: number, branchId: number): Promise<void> =>
    TaskInstanceService['assertMayReview'](userId, branchId);

beforeEach(() => {
    jest.resetAllMocks();
});

describe('assertMayComplete — inactive tasks', () => {
    it('refuses completion once the task is deactivated', async () => {
        await expect(
            assertMayComplete(instance({ assignedTo: ASSIGNEE, active: false }), ASSIGNEE),
        ).rejects.toThrow(InactiveTaskError);
    });

    it('refuses the assignee too — cancellation is about the task, not the person', async () => {
        // the read filter already hides this instance; the guard is what stops a client that
        // still holds the id from completing it anyway
        await expect(
            assertMayComplete(instance({ assignedTo: ASSIGNEE, active: false }), ASSIGNEE),
        ).rejects.toThrow(InactiveTaskError);

        expect(getUserById).not.toHaveBeenCalled();
        expect(getUserBranches).not.toHaveBeenCalled();
    });

    it('reports cancellation ahead of any permission problem', async () => {
        // a wrong user on a cancelled task is told the task is closed, not that they lack rights:
        // otherwise a 403 would send them looking for a permission fix that does not exist
        await expect(
            assertMayComplete(instance({ assignedTo: ASSIGNEE, active: false }), OTHER_USER),
        ).rejects.toThrow(InactiveTaskError);
    });

    it('refuses a role-targeted task as well, without consulting the user at all', async () => {
        await expect(
            assertMayComplete(instance({ assignedRoleId: ROLE, active: false }), ASSIGNEE),
        ).rejects.toThrow(InactiveTaskError);

        expect(getUserById).not.toHaveBeenCalled();
    });

    it('is not a ForbiddenError, so the route maps it to 409 rather than 403', async () => {
        // the completer may be entirely in the right; it is the task's state that conflicts
        expect(new InactiveTaskError()).not.toBeInstanceOf(ForbiddenError);
    });
});

describe('assertMayComplete — task targets a named person', () => {
    it('admits the named assignee without touching the database', async () => {
        await expect(
            assertMayComplete(instance({ assignedTo: ASSIGNEE }), ASSIGNEE),
        ).resolves.toBeUndefined();

        expect(getUserById).not.toHaveBeenCalled();
        expect(getUserBranches).not.toHaveBeenCalled();
    });

    it('refuses anyone else, even a colleague at the same branch', async () => {
        await expect(
            assertMayComplete(instance({ assignedTo: ASSIGNEE }), OTHER_USER),
        ).rejects.toThrow(NotAssignedToTaskError);
    });
});

describe('assertMayComplete — task targets a role', () => {
    it('admits an active holder of the role who works at the branch', async () => {
        getUserById.mockResolvedValue(user());
        getUserBranches.mockResolvedValue(atBranch);

        await expect(
            assertMayComplete(instance({ assignedRoleId: ROLE }), ASSIGNEE),
        ).resolves.toBeUndefined();

        expect(getUserBranches).toHaveBeenCalledWith({ userId: ASSIGNEE, branchId: BRANCH });
    });

    it('refuses a user who does not exist', async () => {
        getUserById.mockResolvedValue(null);

        await expect(
            assertMayComplete(instance({ assignedRoleId: ROLE }), ASSIGNEE),
        ).rejects.toThrow(NotAssignedToTaskError);
    });

    it('refuses a deactivated user', async () => {
        getUserById.mockResolvedValue(user({ isActive: false }));

        await expect(
            assertMayComplete(instance({ assignedRoleId: ROLE }), ASSIGNEE),
        ).rejects.toThrow(NotAssignedToTaskError);
    });

    it('refuses someone holding a different role', async () => {
        getUserById.mockResolvedValue(user({ roleId: ROLE + 1 }));

        await expect(
            assertMayComplete(instance({ assignedRoleId: ROLE }), ASSIGNEE),
        ).rejects.toThrow(NotAssignedToTaskError);
    });

    it('refuses the right role at the wrong branch, and says which it is', async () => {
        getUserById.mockResolvedValue(user());
        getUserBranches.mockResolvedValue([]);

        await expect(
            assertMayComplete(instance({ assignedRoleId: ROLE }), ASSIGNEE),
        ).rejects.toThrow(/do not work at the branch/);
    });

    it('checks the role before spending a query on the branch link', async () => {
        getUserById.mockResolvedValue(user({ roleId: ROLE + 1 }));

        await expect(
            assertMayComplete(instance({ assignedRoleId: ROLE }), ASSIGNEE),
        ).rejects.toThrow(NotAssignedToTaskError);

        expect(getUserBranches).not.toHaveBeenCalled();
    });
});

describe('assertMayReview — restricted to managers', () => {
    it('admits an active manager attached to the branch', async () => {
        getUserById.mockResolvedValue(user({ roleId: MANAGER_ROLE }));
        getRoleById.mockResolvedValue({ roleId: MANAGER_ROLE, name: 'manager' });
        getUserBranches.mockResolvedValue(atBranch);

        await expect(assertMayReview(ASSIGNEE, BRANCH)).resolves.toBeUndefined();
    });

    it('refuses a non-manager, even one attached to the branch', async () => {
        getUserById.mockResolvedValue(user({ roleId: ROLE }));
        getRoleById.mockResolvedValue({ roleId: ROLE, name: 'cashier' });
        getUserBranches.mockResolvedValue(atBranch);

        await expect(assertMayReview(ASSIGNEE, BRANCH)).rejects.toThrow(NotBranchManagerError);
    });

    it('refuses a manager not attached to the branch', async () => {
        getUserById.mockResolvedValue(user({ roleId: MANAGER_ROLE }));
        getRoleById.mockResolvedValue({ roleId: MANAGER_ROLE, name: 'manager' });
        getUserBranches.mockResolvedValue([]);

        await expect(assertMayReview(ASSIGNEE, BRANCH)).rejects.toThrow(NotBranchManagerError);
    });

    it('refuses a deactivated user without consulting their role', async () => {
        getUserById.mockResolvedValue(user({ isActive: false }));

        await expect(assertMayReview(ASSIGNEE, BRANCH)).rejects.toThrow(NotBranchManagerError);

        expect(getRoleById).not.toHaveBeenCalled();
    });
});

describe('review is deliberately not gated on the task being active', () => {
    it('lets a completed instance of a deactivated task still be verified', async () => {
        // otherwise work photographed before the task was closed would strand in `completed`,
        // since that status only exits to verified or rejected
        getInstanceForWrite.mockResolvedValue({
            ...instance({ assignedRoleId: ROLE, active: false }),
            status: TaskStatus.completed,
            completedBy: OTHER_USER,
        });
        getUserById.mockResolvedValue(user({ roleId: MANAGER_ROLE }));
        getRoleById.mockResolvedValue({ roleId: MANAGER_ROLE, name: 'manager' });
        getUserBranches.mockResolvedValue(atBranch);

        await TaskInstanceService.reviewInstance({
            instanceId: 1,
            decision: TaskStatus.verified,
            reviewedBy: ASSIGNEE,
        });

        expect(TaskInstanceRepository.reviewInstance).toHaveBeenCalledWith(
            expect.objectContaining({ instanceId: 1, decision: TaskStatus.verified }),
        );
    });
});
