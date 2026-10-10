import { monthStart, splitByDay } from '@/lib/staff-home';

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
