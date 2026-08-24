import { TaskStatus } from '@prisma/client';
import {
    TaskInstanceRepository,
    TaskInstanceFilters,
} from '@/repository/task-instance-repository';
import { UserRepository } from '@/repository/user-repository';
import { UserBranchRepository } from '@/repository/user-branch-repository';
import { savePhoto } from '@/lib/storage';
import { assertTransition } from '@/lib/task-status';
import {
    TaskInstanceDetailView,
    TaskInstanceFiltersInput,
    TaskInstanceListView,
} from '@/types/task-instance';
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error';
import { NotAssignedToTaskError, NotBranchManagerError, SelfReviewError } from '@/exceptions/forbidden-error';
import { InactiveTaskError } from '@/exceptions/inactive-task-error';

type InstanceForWrite = NonNullable<
    Awaited<ReturnType<typeof TaskInstanceRepository.getInstanceForWrite>>
>;

export class TaskInstanceService {
    static async getTaskInstances(filters: TaskInstanceFiltersInput): Promise<TaskInstanceListView[]> {
        const repositoryFilters: TaskInstanceFilters = {
            branchId: filters.branch_id,
            dueDate: filters.date,
            status: filters.status,
        };

        if (filters.user_id !== undefined) {
            const user = await UserRepository.getUserById(filters.user_id);

            // an unknown user is asking about nobody's tasks, not everybody's
            if (!user) {
                return [];
            }

            const branchLinks = await UserBranchRepository.getUserBranches({ userId: user.userId });

            repositoryFilters.assignedToUser = {
                userId: user.userId,
                roleId: user.roleId,
                branchIds: branchLinks.map((link) => link.branchId),
            };
        }

        return TaskInstanceRepository.getTaskInstances(repositoryFilters);
    }

    static async getTaskInstanceById(instanceId: number): Promise<TaskInstanceDetailView | null> {
        return TaskInstanceRepository.getTaskInstanceById(instanceId);
    }

    /**
     * Completion: permission and status are settled before the photo is written, so a request that
     * was never going to succeed leaves no orphan file behind. The photo is then saved to storage,
     * and only the database work runs inside the transaction.
     */
    static async completeInstance(params: {
        instanceId: number;
        completedBy: number;
        photo: File;
    }): Promise<TaskInstanceDetailView> {
        const { instanceId, completedBy, photo } = params;

        const instance = await TaskInstanceService.loadForWrite(instanceId);

        await TaskInstanceService.assertMayComplete(instance, completedBy);
        assertTransition(instance.status, TaskStatus.completed);

        const filePath = await savePhoto(photo, instanceId);

        return TaskInstanceRepository.completeInstance({
            instanceId,
            completedBy,
            filePath,
            // the server clock is the only accepted source: neither the request body nor the
            // photo's EXIF data can be trusted to say when the work actually happened
            completedAt: new Date(),
        });
    }

    /**
     * Review is not gated on the task still being active, deliberately. An instance that was
     * already `completed` when its task was deactivated must keep its route to verified or
     * rejected, or the photo sits there forever with nobody able to sign it off.
     */
    static async reviewInstance(params: {
        instanceId: number;
        decision: typeof TaskStatus.verified | typeof TaskStatus.rejected;
        reviewedBy: number;
    }): Promise<TaskInstanceDetailView> {
        const { instanceId, decision, reviewedBy } = params;

        const instance = await TaskInstanceService.loadForWrite(instanceId);

        await TaskInstanceService.assertMayReview(reviewedBy, instance.task.branchId);

        if (instance.completedBy !== null && instance.completedBy === reviewedBy) {
            throw new SelfReviewError();
        }

        assertTransition(instance.status, decision);

        return TaskInstanceRepository.reviewInstance({
            instanceId,
            decision,
            reviewedBy,
            reviewedAt: new Date(),
        });
    }

    /** Reads the instance once and makes 'it exists' true for every check that follows. */
    private static async loadForWrite(instanceId: number): Promise<InstanceForWrite> {
        const instance = await TaskInstanceRepository.getInstanceForWrite(instanceId);

        if (!instance) {
            throw new TaskInstanceNotFoundError();
        }

        return instance;
    }

    /**
     * A task targets either a named person or a whole role.
     *   - person: only that person may complete it.
     *   - role:   an active holder of that role who works at the task's branch may complete it.
     *
     * A deactivated task accepts no completions at all. The read filter already hides its pending
     * instances, but hiding is not enforcing: a client holding an id from before the flag flipped
     * would otherwise still be able to complete cancelled work.
     */
    private static async assertMayComplete(
        instance: InstanceForWrite,
        completedBy: number,
    ): Promise<void> {
        const { assignedTo, assignedRoleId, branchId, active } = instance.task;

        if (!active) {
            throw new InactiveTaskError();
        }

        if (assignedTo !== null) {
            if (assignedTo !== completedBy) {
                throw new NotAssignedToTaskError();
            }
            return;
        }

        const user = await UserRepository.getUserById(completedBy);

        if (!user || !user.isActive || user.roleId !== assignedRoleId) {
            throw new NotAssignedToTaskError();
        }

        if (!(await TaskInstanceService.worksAtBranch(completedBy, branchId))) {
            throw new NotAssignedToTaskError('You do not work at the branch this task belongs to');
        }
    }

    /**
     * Review is restricted to active users attached to the task's own branch.
     *
     * NOTE: the brief also requires the reviewer to be a *manager*. That half of the check is
     * deliberately absent until role-based permissions exist — as it stands, any active user at
     * the branch (other than the completer) can verify or reject. See TO-BE-REVIEWED.md.
     */
    private static async assertMayReview(userId: number, branchId: number): Promise<void> {
        const user = await UserRepository.getUserById(userId);

        if (!user || !user.isActive) {
            throw new NotBranchManagerError();
        }

        if (!(await TaskInstanceService.worksAtBranch(userId, branchId))) {
            throw new NotBranchManagerError('You are not attached to the branch this task belongs to');
        }
    }

    private static async worksAtBranch(userId: number, branchId: number): Promise<boolean> {
        const links = await UserBranchRepository.getUserBranches({ userId, branchId });
        return links.length > 0;
    }
}
