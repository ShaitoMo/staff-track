import { buildInstanceRows, daysAgoDateString, parseDateParam, todayDateString } from '@/lib/instance-rows';
import type { TaskInstanceListView } from '@/types/task-instance';

function instance(overrides: {
    id: number;
    title?: string;
    description?: string | null;
    branch?: string;
    assignee?: { user_id: number; name: string } | null;
    roleId?: number | null;
    recurrence?: string | null;
    status?: TaskInstanceListView['status'];
    completedBy?: { id: number; name: string } | null;
    completedAt?: string | null;
    photoId?: number | null;
    reviewedBy?: { name: string } | null;
    reviewedAt?: string | null;
}): TaskInstanceListView {
    return {
        instance_id: overrides.id,
        task_id: overrides.id,
        due_date: '2026-10-01',
        status: overrides.status ?? 'pending',
        completed_by: overrides.completedBy?.id ?? null,
        completed_by_name: overrides.completedBy?.name ?? null,
        completed_at: (overrides.completedAt ?? null) as unknown as Date | null,
        reviewed_by: overrides.reviewedBy ? 9 : null,
        reviewed_by_name: overrides.reviewedBy?.name ?? null,
        reviewed_at: (overrides.reviewedAt ?? null) as unknown as Date | null,
        latest_photo: overrides.photoId
            ? { media_id: overrides.photoId, file_path: '/uploads/x.jpg', uploaded_by: 1, server_timestamp: new Date() }
            : null,
        assignee: overrides.assignee ?? null,
        task: {
            task_id: overrides.id,
            title: overrides.title ?? 'Task',
            description: overrides.description ?? null,
            branch_id: 1,
            branch_name: overrides.branch ?? 'Main',
            assigned_to: overrides.assignee?.user_id ?? null,
            assigned_role_id: overrides.roleId ?? null,
            recurrence: overrides.recurrence ?? null,
        },
    };
}

const roles = [{ roleId: 3, name: 'cashier' }];

describe('todayDateString', () => {
    it('uses the Beirut calendar day, not the UTC one', () => {
        // 22:30 UTC on 30 Sep is already 1 Oct in Beirut (UTC+3 in summer)
        expect(todayDateString(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01');
    });
});

describe('daysAgoDateString', () => {
    it('counts back on the Beirut calendar', () => {
        expect(daysAgoDateString(7, new Date('2026-10-08T10:00:00Z'))).toBe('2026-10-01');
    });
});

describe('parseDateParam', () => {
    const now = new Date('2026-09-30T10:00:00Z');

    it('keeps a real date', () => {
        expect(parseDateParam('2026-10-05', now)).toBe('2026-10-05');
    });

    it.each([undefined, '', 'garbage', '2026-02-31', '10/05/2026'])('falls back to today for %p', (value) => {
        expect(parseDateParam(value, now)).toBe('2026-09-30');
    });
});

describe('buildInstanceRows', () => {
    it('shows the named assignee', () => {
        const [row] = buildInstanceRows([instance({ id: 1, assignee: { user_id: 5, name: 'Bob' } })], roles, 1);
        expect(row.assignee).toBe('Bob');
    });

    it('shows the pooled role when nobody is named', () => {
        const [row] = buildInstanceRows([instance({ id: 1, roleId: 3 })], roles, 1);
        expect(row.assignee).toBe('cashier');
    });

    it('falls back to the role id when the role is unknown', () => {
        const [row] = buildInstanceRows([instance({ id: 1, roleId: 99 })], roles, 1);
        expect(row.assignee).toBe('Role #99');
    });

    it('says Unassigned when there is neither', () => {
        const [row] = buildInstanceRows([instance({ id: 1 })], roles, 1);
        expect(row.assignee).toBe('Unassigned');
    });

    it('sorts by branch then title without mutating the input', () => {
        const input = [
            instance({ id: 1, branch: 'North', title: 'B' }),
            instance({ id: 2, branch: 'Main', title: 'Z' }),
            instance({ id: 3, branch: 'Main', title: 'A' }),
        ];

        expect(buildInstanceRows(input, roles, 1).map((row) => row.instanceId)).toEqual([3, 2, 1]);
        expect(input.map((i) => i.instance_id)).toEqual([1, 2, 3]);
    });

    describe('review fields', () => {
        const completed = (completedById: number) =>
            instance({ id: 1, status: 'completed', completedBy: { id: completedById, name: 'Bob' }, photoId: 40 });

        it('offers review on work completed by someone else', () => {
            const [row] = buildInstanceRows([completed(5)], roles, 1);
            expect(row.canReview).toBe(true);
        });

        it("does not offer review on the viewer's own completion", () => {
            const [row] = buildInstanceRows([completed(1)], roles, 1);
            expect(row.canReview).toBe(false);
        });

        it.each(['pending', 'verified', 'rejected'] as const)('does not offer review on a %s instance', (status) => {
            const [row] = buildInstanceRows([instance({ id: 1, status, completedBy: { id: 5, name: 'Bob' } })], roles, 1);
            expect(row.canReview).toBe(false);
        });

        it('carries the completer name and the photo id', () => {
            const [row] = buildInstanceRows([completed(5)], roles, 1);
            expect(row.completedByName).toBe('Bob');
            expect(row.photoMediaId).toBe(40);
        });

        it('has neither before anyone completes it', () => {
            const [row] = buildInstanceRows([instance({ id: 1 })], roles, 1);
            expect(row.completedByName).toBeNull();
            expect(row.photoMediaId).toBeNull();
        });
    });

    describe('detail fields', () => {
        it('describes a one-off task with no recurrence', () => {
            const [row] = buildInstanceRows([instance({ id: 1 })], roles, 1);
            expect(row.schedule).toBe('One-off');
        });

        it('describes a recurring task by its rule', () => {
            const [row] = buildInstanceRows([instance({ id: 1, recurrence: 'weekly:mon,wed' })], roles, 1);
            expect(row.schedule).toBe('Weekly: Mon, Wed');
        });

        it('carries the task description through', () => {
            const [row] = buildInstanceRows([instance({ id: 1, description: 'Wipe the counters' })], roles, 1);
            expect(row.description).toBe('Wipe the counters');
        });

        it('reduces completed/reviewed timestamps to their calendar day', () => {
            const [row] = buildInstanceRows(
                [instance({
                    id: 1,
                    completedBy: { id: 5, name: 'Bob' },
                    completedAt: '2026-09-26T14:00:00.000Z',
                    reviewedBy: { name: 'Alice' },
                    reviewedAt: '2026-09-27T09:30:00.000Z',
                })],
                roles,
                1,
            );

            expect(row.completedDate).toBe('2026-09-26');
            expect(row.reviewedByName).toBe('Alice');
            expect(row.reviewedDate).toBe('2026-09-27');
        });

        it('has no reviewer before anyone reviews it', () => {
            const [row] = buildInstanceRows([instance({ id: 1 })], roles, 1);
            expect(row.reviewedByName).toBeNull();
            expect(row.reviewedDate).toBeNull();
        });
    });
});
