import { MANAGER_ROLE } from "@/lib/rbac";
import { CoverageGapRow } from "@/types/coverage-gap";
import { Role } from "@/types/role";
import { BranchScheduleView } from "@/types/shift";

/** One period on the day: who is scheduled, never who is in — attendance lags the day. */
export interface DayPeriod {
    /** Null for the shifts on custom hours, grouped last as 'Other hours'. */
    periodId: number | null;
    name: string | null;
    staffCount: number;
    managers: string[];
}

export interface OpenSlot {
    periodName: string;
    roleName: string;
    short: number;
}

export interface BranchDay {
    /** Distinct people, so a split shift counts its person once. */
    staffCount: number;
    periods: DayPeriod[];
    openSlots: OpenSlot[];
}

const distinct = (values: (string | number)[]) => new Set(values).size;

/**
 * One branch's day: how many are scheduled, per period with the scheduled manager(s), and the
 * roles still short of their requirement. Periods nobody works are left out.
 */
export function branchDay(schedule: BranchScheduleView, date: string, gaps: CoverageGapRow[], roles: Role[]): BranchDay {
    const shifts = schedule.shifts.filter((shift) => shift.shift_date === date);
    const known = new Set(schedule.periods.map((period) => period.period_id));

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
        .filter((group) => group.shifts.length > 0)
        .map((group) => ({
            periodId: group.periodId,
            name: group.name,
            staffCount: distinct(group.shifts.map((shift) => shift.user_id)),
            managers: [
                ...new Set(group.shifts.filter((shift) => shift.role_name === MANAGER_ROLE).map((shift) => shift.user_name)),
            ].toSorted(),
        }));

    const periodNames = new Map(schedule.periods.map((period) => [period.period_id, period.name]));
    const roleNames = new Map(roles.map((role) => [role.roleId, role.name]));

    const openSlots = gaps
        .filter((gap) => gap.shiftDate === date && gap.requiredCount > gap.scheduledCount)
        .map((gap) => ({
            periodName: periodNames.get(gap.periodId) ?? `Period ${gap.periodId}`,
            roleName: roleNames.get(gap.roleId) ?? `Role ${gap.roleId}`,
            short: gap.requiredCount - gap.scheduledCount,
        }));

    return { staffCount: distinct(shifts.map((shift) => shift.user_id)), periods, openSlots };
}
