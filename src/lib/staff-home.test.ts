import type { InstanceRow } from '@/lib/instance-rows';
import { branchFirst, monthStart, shiftNow, splitByDay, splitMissed } from '@/lib/staff-home';
import type { MyShift } from '@/lib/staff-schedule';

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

describe('shiftNow', () => {
    const shift = (shiftId: number, startTime: string, endTime: string): MyShift => ({
        shiftId,
        date: '2026-10-06',
        startTime,
        endTime,
        periodName: null,
        registerName: null,
        branchName: 'Hamra',
    });
    const morning = shift(1, '07:00:00', '11:00:00');
    const evening = shift(2, '17:00:00', '21:00:00');

    it('is none with no shift today', () => {
        expect(shiftNow([], '09:00')).toEqual({ kind: 'none' });
    });

    it('is on from the start up to the end, with the minutes left and the shift after', () => {
        expect(shiftNow([evening, morning], '07:00')).toEqual({ kind: 'on', shift: morning, minutesLeft: 240, next: evening });
        expect(shiftNow([morning], '10:40')).toEqual({ kind: 'on', shift: morning, minutesLeft: 20, next: null });
    });

    it('is later before a shift starts, including between two shifts', () => {
        expect(shiftNow([morning, evening], '06:30')).toEqual({ kind: 'later', shift: morning, next: evening });
        expect(shiftNow([morning, evening], '11:00')).toEqual({ kind: 'later', shift: evening, next: null });
    });

    it('is done once the last shift has ended', () => {
        expect(shiftNow([morning, evening], '21:00')).toEqual({ kind: 'done', shift: evening });
    });
});

describe('splitMissed', () => {
    const today = '2026-10-06';
    let nextId = 1;
    const row = (taskId: number, dueDate: string, overrides: Partial<InstanceRow> = {}): InstanceRow => ({
        instanceId: nextId++,
        taskId,
        recurring: true,
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

    it("folds a recurring task's missed copies into one run and keeps today's copy doable", () => {
        const todays = row(1, '2026-10-06');
        const { doable, missed } = splitMissed([row(1, '2026-10-04'), todays, row(1, '2026-10-03'), row(1, '2026-10-05')], today);

        expect(doable).toEqual([todays]);
        expect(missed).toEqual([{ taskId: 1, title: 'Task 1', branchName: 'Hamra', days: 3, oldestDueDate: '2026-10-03' }]);
    });

    it('keeps an overdue one-off doable, ahead of today', () => {
        const oneOff = row(2, '2026-10-01', { recurring: false });
        const todays = row(1, '2026-10-06');

        expect(splitMissed([todays, oneOff], today)).toEqual({ doable: [oneOff, todays], missed: [] });
    });

    it('lists the longest-missed task first', () => {
        const { missed } = splitMissed([row(1, '2026-10-05'), row(2, '2026-10-04'), row(2, '2026-10-05')], today);

        expect(missed.map((run) => [run.taskId, run.days])).toEqual([[2, 2], [1, 1]]);
    });
});

describe('branchFirst', () => {
    it("puts the given branch first and keeps each branch's order", () => {
        const items = [
            { branchName: 'Achrafieh', n: 1 },
            { branchName: 'Hamra', n: 2 },
            { branchName: 'Achrafieh', n: 3 },
            { branchName: 'Hamra', n: 4 },
        ];

        expect(branchFirst(items, 'Hamra').map((item) => item.n)).toEqual([2, 4, 1, 3]);
        expect(branchFirst(items, null).map((item) => item.n)).toEqual([1, 3, 2, 4]);
    });
});
