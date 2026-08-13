import { Prisma, TaskStatus } from '@prisma/client';

// The module builds a PrismaPg adapter at import time; the tests below never reach the database,
// so an empty stand-in keeps the suite from needing DATABASE_URL.
jest.mock('@/lib/db', () => ({ db: {} }));

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
