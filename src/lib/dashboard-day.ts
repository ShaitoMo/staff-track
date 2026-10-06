import { MANAGER_ROLE } from "@/lib/rbac";
import { CoverageGapRow } from "@/types/coverage-gap";
import { Role } from "@/types/role";
import { BranchScheduleView } from "@/types/shift";

/** A role still short of its requirement in one period. */
export interface Shortage {
    roleName: string;
    short: number;
}

/** One period on the day: who is scheduled, never who is in — attendance lags the day. */
export interface DayPeriod {
    /** Null for the shifts on custom hours, grouped last as 'Other hours'. */
    periodId: number | null;
    name: string | null;
    staffCount: number;
    managers: string[];
    shortages: Shortage[];
}

export interface BranchDay {
    /** Distinct people, so a split shift counts its person once. */
    staffCount: number;
    periods: DayPeriod[];
    /** Every role-slot still unfilled across the day's periods. */
    shortTotal: number;
}

const distinct = (values: (string | number)[]) => new Set(values).size;

/**
 * One branch's day, period by period: how many are scheduled, the scheduled manager(s), and the
 * roles still short of their requirement. A period shows when someone works it or when it is
 * still short — an unstaffed period that's required is the thing a manager most needs to see.
 */
export function branchDay(schedule: BranchScheduleView, date: string, gaps: CoverageGapRow[], roles: Role[]): BranchDay {
    const shifts = schedule.shifts.filter((shift) => shift.shift_date === date);
    const known = new Set(schedule.periods.map((period) => period.period_id));
    const roleNames = new Map(roles.map((role) => [role.roleId, role.name]));

    const shortagesOf = (periodId: number | null): Shortage[] =>
        gaps
            .filter((gap) => gap.shiftDate === date && gap.periodId === periodId && gap.requiredCount > gap.scheduledCount)
            .map((gap) => ({ roleName: roleNames.get(gap.roleId) ?? `Role ${gap.roleId}`, short: gap.requiredCount - gap.scheduledCount }));

    const groups = [
        ...schedule.periods.map((period) => ({
            periodId: period.period_id as number | null,
            name: period.name as string | null,
            shifts: shifts.filter((shift) => shift.period_id === period.period_id),
        })),
        {
            periodId: null,
            name: null,
            shifts: shifts.filter((shift) => shift.period_id === null || !known.has(shift.period_id)),
        },
    ];

    const periods = groups
        .map((group) => ({
            periodId: group.periodId,
            name: group.name,
            staffCount: distinct(group.shifts.map((shift) => shift.user_id)),
            managers: [
                ...new Set(group.shifts.filter((shift) => shift.role_name === MANAGER_ROLE).map((shift) => shift.user_name)),
            ].toSorted(),
            // requirements are per named period; custom hours have none
            shortages: group.periodId === null ? [] : shortagesOf(group.periodId),
        }))
        .filter((period) => period.staffCount > 0 || period.shortages.length > 0);

    return {
        staffCount: distinct(shifts.map((shift) => shift.user_id)),
        periods,
        shortTotal: periods.reduce((total, period) => total + period.shortages.reduce((sum, item) => sum + item.short, 0), 0),
    };
}
