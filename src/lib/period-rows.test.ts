import { buildPeriodRows } from '@/lib/period-rows';
import { Branch } from '@/types/branch';
import { ShiftPeriodView } from '@/types/shift-period';

const branches = [{ branchId: 1, name: 'Hamra' }, { branchId: 2, name: 'Verdun' }] as Branch[];

function period(overrides: Partial<ShiftPeriodView>): ShiftPeriodView {
    return {
        periodId: 1,
        branchId: 1,
        name: 'Morning',
        defaultStart: '07:00',
        defaultEnd: '15:00',
        sortOrder: 0,
        active: true,
        ...overrides,
    };
}

const chainWide = period({ periodId: 9, branchId: null, name: 'Night', defaultStart: '22:00', defaultEnd: '23:30' });

describe('buildPeriodRows', () => {
    it('shows a chain-wide period once, though every branch lists it', () => {
        const rows = buildPeriodRows([[period({}), chainWide], [period({ periodId: 2, branchId: 2 }), chainWide]], branches, true);

        expect(rows.map((row) => row.periodId)).toEqual([1, 2, 9]);
    });

    it('labels the branch, and "All branches" for a chain-wide period', () => {
        const rows = buildPeriodRows([[period({}), chainWide]], branches, true);

        expect(rows.map((row) => row.branchName)).toEqual(['Hamra', 'All branches']);
        expect(rows[0].hours).toBe('07:00–15:00');
    });

    it('orders by sort order, then start time', () => {
        const rows = buildPeriodRows(
            [[
                period({ periodId: 1, name: 'Evening', defaultStart: '15:00', sortOrder: 0 }),
                period({ periodId: 2, name: 'Morning', defaultStart: '07:00', sortOrder: 0 }),
                period({ periodId: 3, name: 'Close', defaultStart: '06:00', sortOrder: 1 }),
            ]],
            branches,
            true,
        );

        expect(rows.map((row) => row.name)).toEqual(['Morning', 'Evening', 'Close']);
    });

    it('keeps inactive periods, marked', () => {
        const [row] = buildPeriodRows([[period({ active: false })]], branches, true);

        expect(row.active).toBe(false);
    });

    it("leaves chain-wide periods unchangeable for a manager, and the branch's own changeable", () => {
        const rows = buildPeriodRows([[period({}), chainWide]], branches, false);

        expect(rows.map((row) => row.canChange)).toEqual([true, false]);
    });
});
