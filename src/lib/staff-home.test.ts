import type { InstanceRow } from '@/lib/instance-rows';
import { collapseOverdue, monthStart, splitByDay } from '@/lib/staff-home';

describe('monthStart', () => {
    it('is the 1st of the same month', () => {
        expect(monthStart('2026-10-06')).toBe('2026-10-01');
    });
});

describe('splitByDay', () => {
    it('puts overdue and today under today, the rest under tomorrow', () => {
        const dates = ['2026-10-04', '2026-10-06', '2026-10-07'];

        expect(splitByDay(dates, (date) => date, '2026-10-06')).toEqual({
            today: ['2026-10-04', '2026-10-06'],
            tomorrow: ['2026-10-07'],
        });
    });
});

describe('collapseOverdue', () => {
    const today = '2026-10-06';
    let nextId = 1;
    const row = (taskId: number, dueDate: string, overrides: Partial<InstanceRow> = {}): InstanceRow => ({
        instanceId: nextId++,
        taskId,
        title: `Task ${taskId}`,
        description: null,
        branchName: 'Hamra',
        assignee: 'cashier',
        schedule: 'Every day',
        dueDate,
        status: 'pending',
        completedByName: null,
        completedDate: null,
        photoMediaId: null,
        referenceName: null,
        reviewedByName: null,
        reviewedDate: null,
        canReview: false,
        ...overrides,
    });

    it("folds one task's overdue copies into its latest, counting the days missed", () => {
        const latest = row(1, '2026-10-05');
        const result = collapseOverdue([row(1, '2026-10-03'), latest, row(1, '2026-10-04')], today);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ instanceId: latest.instanceId, missedDays: 3, oldestDueDate: '2026-10-03' });
    });

    it("leaves today's and tomorrow's copies, and other tasks, as their own cards", () => {
        const result = collapseOverdue(
            [row(1, '2026-10-07'), row(1, '2026-10-06'), row(1, '2026-10-04'), row(2, '2026-10-05')],
            today,
        );

        expect(result.map((r) => [r.taskId, r.dueDate, r.missedDays])).toEqual([
            [1, '2026-10-04', 1],
            [2, '2026-10-05', 1],
            [1, '2026-10-06', 1],
            [1, '2026-10-07', 1],
        ]);
    });

    it('does not fold finished copies, even past ones', () => {
        const result = collapseOverdue(
            [row(1, '2026-10-04', { status: 'completed' }), row(1, '2026-10-05', { status: 'rejected' })],
            today,
        );

        expect(result.map((r) => r.missedDays)).toEqual([1, 1]);
    });
});
