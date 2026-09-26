import { buildInstanceRows, parseDateParam, todayDateString } from '@/lib/instance-rows';
import type { TaskInstanceListView } from '@/types/task-instance';

function instance(overrides: {
    id: number;
    title?: string;
    branch?: string;
    assignee?: { user_id: number; name: string } | null;
    roleId?: number | null;
}): TaskInstanceListView {
    return {
        instance_id: overrides.id,
        task_id: overrides.id,
        due_date: '2026-10-01',
        status: 'pending',
        completed_by: null,
        completed_at: null,
        reviewed_by: null,
        reviewed_at: null,
        latest_photo: null,
        assignee: overrides.assignee ?? null,
        task: {
            task_id: overrides.id,
            title: overrides.title ?? 'Task',
            description: null,
            branch_id: 1,
            branch_name: overrides.branch ?? 'Main',
            assigned_to: overrides.assignee?.user_id ?? null,
            assigned_role_id: overrides.roleId ?? null,
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
        const [row] = buildInstanceRows([instance({ id: 1, assignee: { user_id: 5, name: 'Bob' } })], roles);
        expect(row.assignee).toBe('Bob');
    });

    it('shows the pooled role when nobody is named', () => {
        const [row] = buildInstanceRows([instance({ id: 1, roleId: 3 })], roles);
        expect(row.assignee).toBe('cashier');
    });

    it('falls back to the role id when the role is unknown', () => {
        const [row] = buildInstanceRows([instance({ id: 1, roleId: 99 })], roles);
        expect(row.assignee).toBe('Role #99');
    });

    it('says Unassigned when there is neither', () => {
        const [row] = buildInstanceRows([instance({ id: 1 })], roles);
        expect(row.assignee).toBe('Unassigned');
    });

    it('sorts by branch then title without mutating the input', () => {
        const input = [
            instance({ id: 1, branch: 'North', title: 'B' }),
            instance({ id: 2, branch: 'Main', title: 'Z' }),
            instance({ id: 3, branch: 'Main', title: 'A' }),
        ];

        expect(buildInstanceRows(input, roles).map((row) => row.instanceId)).toEqual([3, 2, 1]);
        expect(input.map((i) => i.instance_id)).toEqual([1, 2, 3]);
    });
});
