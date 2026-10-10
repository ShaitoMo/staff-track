import {
    addDays,
    buildRequirementGrid,
    buildWeeklyCoverage,
    formatDay,
    mondayOf,
    parseRequiredCount,
    sortPeriods,
} from '@/lib/coverage-rows';
import { CoverageGapRow } from '@/types/coverage-gap';
import { CoverageRequirementView } from '@/types/coverage-requirement';
import { ShiftPeriodView } from '@/types/shift-period';

const cashier = { roleId: 1, name: 'Cashier' };
const baker = { roleId: 2, name: 'Baker' };

function period(periodId: number, name: string, sortOrder: number, defaultStart = '08:00'): ShiftPeriodView {
    return { periodId, branchId: 1, name, defaultStart, defaultEnd: '16:00', sortOrder, active: true };
}

const morning = period(10, 'Morning', 1);
const evening = period(11, 'Evening', 2, '16:00');

function requirement(requirementId: number, role: typeof cashier, p: ShiftPeriodView, requiredCount: number): CoverageRequirementView {
    return { requirementId, branchId: 1, requiredCount, role, period: p };
}

describe('mondayOf', () => {
    it.each([
        ['2026-09-28', '2026-09-28'], // Monday stays
        ['2026-09-30', '2026-09-28'], // Wednesday
        ['2026-10-04', '2026-09-28'], // Sunday belongs to the week that started the Monday before
        ['2026-10-05', '2026-10-05'],
    ])('%s -> %s', (input, expected) => {
        expect(mondayOf(input)).toBe(expected);
    });

    it('crosses a month and year boundary', () => {
        expect(mondayOf('2027-01-01')).toBe('2026-12-28');
    });
});

describe('formatDay', () => {
    it('gives the same three-letter month style for every month', () => {
        expect(formatDay('2026-09-28')).toBe('Mon 28 Sep');
        expect(formatDay('2026-10-01')).toBe('Thu 1 Oct');
    });
});

describe('addDays', () => {
    it('moves forward and backward across months', () => {
        expect(addDays('2026-09-28', 7)).toBe('2026-10-05');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });
});

describe('parseRequiredCount', () => {
    it.each([
        ['0', 0],
        ['3', 3],
        [' 12 ', 12],
    ])('accepts %j', (input, expected) => {
        expect(parseRequiredCount(input)).toBe(expected);
    });

    it('accepts the maximum and rejects one above it', () => {
        expect(parseRequiredCount('999')).toBe(999);
        expect(parseRequiredCount('1000')).toBeNull();
    });

    it.each(['', '  ', '-1', '1.5', 'two', '1e3', '9999999999', '99999999999999999999'])('rejects %j', (input) => {
        expect(parseRequiredCount(input)).toBeNull();
    });
});

describe('buildRequirementGrid', () => {
    it('gives one row per role sorted by name, with a cell per period', () => {
        const grid = buildRequirementGrid([cashier, baker], [morning, evening], []);

        expect(grid.map((row) => row.roleName)).toEqual(['Baker', 'Cashier']);
        expect(grid[0].cells.map((cell) => cell.periodId)).toEqual([10, 11]);
    });

    it('leaves a cell null when no requirement exists, and keeps a real 0', () => {
        const grid = buildRequirementGrid([cashier], [morning, evening], [requirement(5, cashier, evening, 0)]);

        expect(grid[0].cells[0]).toEqual({ periodId: 10, requirementId: null, requiredCount: null });
        expect(grid[0].cells[1]).toEqual({ periodId: 11, requirementId: 5, requiredCount: 0 });
    });
});

describe('sortPeriods', () => {
    it('orders by sortOrder, then start time, without mutating the input', () => {
        const input = [evening, period(12, 'Early', 1, '06:00'), morning];

        expect(sortPeriods(input).map((p) => p.name)).toEqual(['Early', 'Morning', 'Evening']);
        expect(input[0]).toBe(evening);
    });
});

describe('buildWeeklyCoverage', () => {
    const weekStart = '2026-09-28';

    function gap(shiftDate: string, required: number, scheduled: number, roleId = 1, periodId = 10): CoverageGapRow {
        return { shiftDate, roleId, periodId, requiredCount: required, scheduledCount: scheduled };
    }

    it('returns nothing for a branch with no requirements', () => {
        expect(buildWeeklyCoverage([], [cashier], [morning], weekStart)).toEqual([]);
    });

    it('fills all seven days and computes the shortfall', () => {
        const rows = buildWeeklyCoverage([gap('2026-09-28', 2, 1), gap('2026-09-29', 2, 3)], [cashier], [morning], weekStart);

        expect(rows).toHaveLength(1);
        expect(rows[0].roleName).toBe('Cashier');
        expect(rows[0].periodName).toBe('Morning');
        expect(rows[0].days.map((day) => day.shiftDate)).toEqual([
            '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
        ]);
        expect(rows[0].days[0]).toMatchObject({ required: 2, scheduled: 1, shortfall: 1 });
        expect(rows[0].days[1]).toMatchObject({ required: 2, scheduled: 3, shortfall: 0 });
        expect(rows[0].days[2]).toMatchObject({ required: 0, scheduled: 0, shortfall: 0 });
    });

    it('orders by role name, then period order', () => {
        const rows = buildWeeklyCoverage(
            [gap('2026-09-28', 1, 0, 1, 11), gap('2026-09-28', 1, 0, 1, 10), gap('2026-09-28', 1, 0, 2, 10)],
            [cashier, baker],
            [morning, evening],
            weekStart,
        );

        expect(rows.map((row) => `${row.roleName}/${row.periodName}`)).toEqual([
            'Baker/Morning',
            'Cashier/Morning',
            'Cashier/Evening',
        ]);
    });

    it('leaves out a role the viewer cannot see instead of showing its id', () => {
        const rows = buildWeeklyCoverage(
            [gap('2026-09-28', 1, 0, 99, 10), gap('2026-09-28', 1, 0, 1, 10)],
            [cashier],
            [morning],
            weekStart,
        );

        expect(rows.map((row) => row.roleName)).toEqual(['Cashier']);
    });

    it('falls back to a placeholder name for an unknown period', () => {
        const rows = buildWeeklyCoverage([gap('2026-09-28', 1, 0, 1, 98)], [cashier], [], weekStart);

        expect(rows[0].periodName).toBe('Period 98');
    });
});
