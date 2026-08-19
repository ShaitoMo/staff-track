import { CoverageRequirementSummary, resolveCoverageGaps } from '@/lib/coverage-gaps';
import { ScheduledShiftRoleRow } from '@/repository/coverage-repository';

const MONDAY = '2026-07-06';
const TUESDAY = '2026-07-07';

function requirement(overrides: Partial<CoverageRequirementSummary> = {}): CoverageRequirementSummary {
    return {
        roleId: 1,
        periodId: 1,
        requiredCount: 2,
        ...overrides,
    };
}

function scheduledShift(overrides: Partial<ScheduledShiftRoleRow> = {}): ScheduledShiftRoleRow {
    return {
        shiftDate: new Date(`${MONDAY}T00:00:00.000Z`),
        periodId: 1,
        roleId: 1,
        ...overrides,
    };
}

describe('resolveCoverageGaps', () => {
    it('applies every requirement to every date in the week', () => {
        const rows = resolveCoverageGaps([MONDAY, TUESDAY], [requirement()], []);

        expect(rows).toEqual([
            { shiftDate: MONDAY, roleId: 1, periodId: 1, requiredCount: 2, scheduledCount: 0 },
            { shiftDate: TUESDAY, roleId: 1, periodId: 1, requiredCount: 2, scheduledCount: 0 },
        ]);
    });

    it('counts scheduled shifts matching the date, role, and period', () => {
        const rows = resolveCoverageGaps(
            [MONDAY],
            [requirement({ requiredCount: 3 })],
            [scheduledShift(), scheduledShift()],
        );

        expect(rows[0].scheduledCount).toBe(2);
    });

    it('keeps an explicit requiredCount of 0 as a row, not an absence', () => {
        const rows = resolveCoverageGaps([MONDAY], [requirement({ requiredCount: 0 })], []);

        expect(rows).toEqual([
            { shiftDate: MONDAY, roleId: 1, periodId: 1, requiredCount: 0, scheduledCount: 0 },
        ]);
    });

    it('keeps roles and periods separate even when counts collide', () => {
        const rows = resolveCoverageGaps(
            [MONDAY],
            [requirement({ roleId: 1, periodId: 1 }), requirement({ roleId: 2, periodId: 1 })],
            [scheduledShift({ roleId: 1 }), scheduledShift({ roleId: 2 }), scheduledShift({ roleId: 2 })],
        );

        const byRole = new Map(rows.map((row) => [row.roleId, row.scheduledCount]));
        expect(byRole.get(1)).toBe(1);
        expect(byRole.get(2)).toBe(2);
    });

    it('ignores a scheduled shift from a different period than the requirement names', () => {
        const rows = resolveCoverageGaps(
            [MONDAY],
            [requirement({ periodId: 1 })],
            [scheduledShift({ periodId: 2 })],
        );

        expect(rows[0].scheduledCount).toBe(0);
    });

    it('ignores a scheduled shift on a date outside the requested week', () => {
        const rows = resolveCoverageGaps(
            [MONDAY],
            [requirement()],
            [scheduledShift({ shiftDate: new Date(`${TUESDAY}T00:00:00.000Z`) })],
        );

        expect(rows[0].scheduledCount).toBe(0);
    });

    it('produces no rows for a branch with no requirements', () => {
        expect(resolveCoverageGaps([MONDAY, TUESDAY], [], [scheduledShift()])).toEqual([]);
    });
});
