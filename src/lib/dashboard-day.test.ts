import { branchDay } from '@/lib/dashboard-day';
import { BranchScheduleShift, BranchScheduleView } from '@/types/shift';

let nextId = 1;

function shift(overrides: Partial<BranchScheduleShift>): BranchScheduleShift {
    return {
        shift_id: nextId++,
        user_id: 1,
        user_name: 'Bob',
        role_name: 'cashier',
        shift_date: '2026-09-30',
        start_time: '08:00',
        end_time: '16:00',
        period_id: 1,
        register_name: null,
        ...overrides,
    };
}

function schedule(shifts: BranchScheduleShift[]): BranchScheduleView {
    return {
        branch_id: 1,
        branch_name: 'Main',
        periods: [
            { period_id: 1, name: 'Morning' },
            { period_id: 2, name: 'Evening' },
        ],
        shifts,
    };
}

const roles = [
    { roleId: 1, name: 'manager' },
    { roleId: 2, name: 'cashier' },
];

describe('branchDay', () => {
    it('counts distinct people on the date only, per period in order, custom hours last', () => {
        const day = branchDay(
            schedule([
                shift({ user_id: 3, user_name: 'Carol', period_id: 2 }),
                shift({ user_id: 1, user_name: 'Bob', period_id: 1 }),
                // Bob again after lunch: still one person
                shift({ user_id: 1, user_name: 'Bob', period_id: 1, start_time: '13:00' }),
                shift({ user_id: 5, user_name: 'Frank', period_id: null, start_time: '06:00' }),
                shift({ user_id: 9, shift_date: '2026-10-01' }),
            ]),
            '2026-09-30',
            [],
            roles,
        );

        expect(day.staffCount).toBe(3);
        expect(day.periods.map((period) => [period.name, period.staffCount])).toEqual([
            ['Morning', 1],
            ['Evening', 1],
            [null, 1],
        ]);
    });

    it('names the scheduled managers, and none where there are none', () => {
        const day = branchDay(
            schedule([
                shift({ user_id: 2, user_name: 'Alice', role_name: 'manager', period_id: 1 }),
                shift({ user_id: 1, period_id: 1 }),
                shift({ user_id: 3, period_id: 2 }),
            ]),
            '2026-09-30',
            [],
            roles,
        );

        expect(day.periods.map((period) => period.managers)).toEqual([['Alice'], []]);
    });

    it('keeps a required period nobody works, with only the roles still short that day', () => {
        const day = branchDay(
            schedule([shift({ user_id: 1, period_id: 1 })]),
            '2026-09-30',
            [
                { shiftDate: '2026-09-30', roleId: 2, periodId: 2, requiredCount: 2, scheduledCount: 0 },
                { shiftDate: '2026-09-30', roleId: 1, periodId: 1, requiredCount: 1, scheduledCount: 1 },
                { shiftDate: '2026-10-01', roleId: 2, periodId: 1, requiredCount: 3, scheduledCount: 0 },
            ],
            roles,
        );

        expect(day.periods).toEqual([
            { periodId: 1, name: 'Morning', staffCount: 1, managers: [], shortages: [] },
            { periodId: 2, name: 'Evening', staffCount: 0, managers: [], shortages: [{ roleName: 'cashier', short: 2 }] },
        ]);
        expect(day.shortTotal).toBe(2);
    });

    it('leaves out a period nobody works and nothing requires', () => {
        const day = branchDay(schedule([]), '2026-09-30', [], roles);

        expect(day).toEqual({ staffCount: 0, periods: [], shortTotal: 0 });
    });
});
