import { Prisma, TaskStatus } from '@prisma/client';

// The module builds a PrismaPg adapter at import time; the tests below never reach the database,
// so an empty stand-in keeps the suite from needing DATABASE_URL.
jest.mock('@/lib/db', () => ({ db: {} }));

import { db } from '@/lib/db';
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error';
import { TaskInstanceRepository, TaskInstanceFilters } from '@/repository/task-instance-repository';

/** `buildWhere` is private; element access is the standard way to reach it without widening the API. */
const buildWhere = (filters: TaskInstanceFilters = {}): Prisma.TaskInstanceWhereInput =>
    TaskInstanceRepository['buildWhere'](filters);

/** What every list query carries: cancelled work is hidden, finished work is not. */
const CANCELLATION_OR = [
    { status: { not: TaskStatus.pending } },
    { task: { active: true } },
];

describe('buildWhere — cancellation', () => {
    it('hides pending instances of inactive tasks on an unfiltered query', () => {
        expect(buildWhere().OR).toEqual(CANCELLATION_OR);
    });

    it('applies the same rule whatever else is being filtered on', () => {
        const filters: TaskInstanceFilters[] = [
            { branchId: 1 },
            { status: TaskStatus.completed },
            { dueDate: new Date('2026-08-13T00:00:00Z') },
            { assignedToUser: { userId: 7, roleId: 2, branchIds: [1] } },
        ];

        for (const filter of filters) {
            expect(buildWhere(filter).OR).toEqual(CANCELLATION_OR);
        }
    });

    it('keeps completed, verified and rejected history reachable', () => {
        // the first arm is what spares them: only `pending` is ever conditional on task.active
        const [historyArm] = buildWhere().OR as Prisma.TaskInstanceWhereInput[];

        expect(historyArm).toEqual({ status: { not: TaskStatus.pending } });
    });

    it('does not collide with the assignment OR, which lives on the task relation', () => {
        const where = buildWhere({ assignedToUser: { userId: 7, roleId: 2, branchIds: [1, 4] } });

        // two separate ORs, ANDed by Prisma: one over the instance, one inside the relation filter
        expect(where.OR).toEqual(CANCELLATION_OR);
        expect((where.task as Prisma.TaskWhereInput).OR).toEqual([
            { assignedTo: 7 },
            { assignedRoleId: 2, branchId: { in: [1, 4] } },
        ]);
    });
});

describe('buildWhere — filters', () => {
    it('omits the task relation filter entirely when nothing constrains the task', () => {
        expect(buildWhere({ status: TaskStatus.pending }).task).toBeUndefined();
    });

    it('passes dueDate and status straight through', () => {
        const dueDate = new Date('2026-08-13T00:00:00Z');
        const where = buildWhere({ dueDate, status: TaskStatus.pending });

        expect(where.dueDate).toBe(dueDate);
        expect(where.status).toBe(TaskStatus.pending);
    });

    it('leaves dueDate and status unset when not supplied, so they do not narrow the query', () => {
        const where = buildWhere({ branchId: 1 });

        expect(where.dueDate).toBeUndefined();
        expect(where.status).toBeUndefined();
    });

    it('scopes to a branch', () => {
        expect(buildWhere({ branchId: 3 }).task).toEqual({ branchId: 3 });
    });

    it('reads a role assignment as role-plus-branch, never role alone', () => {
        const where = buildWhere({ assignedToUser: { userId: 7, roleId: 2, branchIds: [1, 4] } });
        const [, roleArm] = (where.task as Prisma.TaskWhereInput).OR as Prisma.TaskWhereInput[];

        // a role-targeted task only reaches people who work at that task's branch
        expect(roleArm).toEqual({ assignedRoleId: 2, branchId: { in: [1, 4] } });
    });

    it('gives a user attached to no branch an empty branch list rather than an open one', () => {
        const where = buildWhere({ assignedToUser: { userId: 7, roleId: 2, branchIds: [] } });
        const [, roleArm] = (where.task as Prisma.TaskWhereInput).OR as Prisma.TaskWhereInput[];

        expect(roleArm).toEqual({ assignedRoleId: 2, branchId: { in: [] } });
    });

    it('combines a branch scope and an assignment scope under one task filter', () => {
        const where = buildWhere({
            branchId: 3,
            assignedToUser: { userId: 7, roleId: 2, branchIds: [3] },
        });

        expect(where.task).toEqual({
            branchId: 3,
            OR: [{ assignedTo: 7 }, { assignedRoleId: 2, branchId: { in: [3] } }],
        });
    });
});

describe('completeInstance and reviewInstance — conditional writes', () => {
    /** A transaction client whose conditional update matches `matched` rows. */
    function fakeTransaction(matched: number, currentStatus: TaskStatus = TaskStatus.completed) {
        const tx = {
            taskInstance: {
                updateMany: jest.fn().mockResolvedValue({ count: matched }),
                findUnique: jest.fn().mockResolvedValue({ status: currentStatus }),
                findUniqueOrThrow: jest.fn().mockResolvedValue({
                    instanceId: 1,
                    taskId: 1,
                    dueDate: new Date('2026-10-01T00:00:00Z'),
                    status: TaskStatus.completed,
                    completedBy: 5,
                    completedAt: null,
                    reviewedBy: null,
                    reviewedAt: null,
                    completer: { name: 'Bob' },
                    reviewer: null,
                    media: [],
                    task: {
                        taskId: 1, title: 'T', description: null, branchId: 1, assignedTo: null,
                        assignedRoleId: 3, recurrence: null, branch: { name: 'Main' }, assignee: null,
                    },
                }),
            },
            media: { create: jest.fn() },
        };

        (db as unknown as { $transaction: unknown }).$transaction = jest.fn(
            async (run: (client: typeof tx) => unknown) => run(tx),
        );

        return tx;
    }

    const complete = () =>
        TaskInstanceRepository.completeInstance({
            instanceId: 1, completedBy: 5, filePath: '/uploads/x.jpg', completedAt: new Date(),
        });

    const review = () =>
        TaskInstanceRepository.reviewInstance({
            instanceId: 1, decision: TaskStatus.verified, reviewedBy: 9, reviewedAt: new Date(),
        });

    it('completes a pending instance, writing the media row and returning the completer name', async () => {
        const tx = fakeTransaction(1);

        const view = await complete();

        expect(tx.taskInstance.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { instanceId: 1, status: TaskStatus.pending } }),
        );
        expect(tx.media.create).toHaveBeenCalledTimes(1);
        expect(view.completed_by_name).toBe('Bob');
    });

    it('refuses a completion that lost the race, and writes no media row', async () => {
        const tx = fakeTransaction(0, TaskStatus.completed);

        await expect(complete()).rejects.toThrow(InvalidStatusTransitionError);
        expect(tx.media.create).not.toHaveBeenCalled();
    });

    it('reviews only a completed instance', async () => {
        const tx = fakeTransaction(1);

        await review();

        expect(tx.taskInstance.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { instanceId: 1, status: TaskStatus.completed } }),
        );
    });

    it('refuses a review that lost the race, reporting the status it found', async () => {
        fakeTransaction(0, TaskStatus.rejected);

        await expect(review()).rejects.toMatchObject({
            name: 'InvalidStatusTransitionError',
            from: TaskStatus.rejected,
            to: TaskStatus.verified,
        });
    });
});
