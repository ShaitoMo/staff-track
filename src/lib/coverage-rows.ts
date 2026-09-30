import { CoverageGapRow } from "@/types/coverage-gap";
import { CoverageRequirementView } from "@/types/coverage-requirement";
import { toDateOnlyString } from "@/types/date-only";
import { Role } from "@/types/role";
import { ShiftPeriodView } from "@/types/shift-period";

const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;

export function addDays(dateString: string, days: number): string {
    return toDateOnlyString(new Date(new Date(`${dateString}T00:00:00.000Z`).getTime() + days * MS_PER_DAY));
}

/** The Monday on or before the given 'YYYY-MM-DD' day, so the week always reads Monday to Sunday. */
export function mondayOf(dateString: string): string {
    const weekday = new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
    return addDays(dateString, -((weekday + 6) % DAYS_IN_WEEK));
}

/** 'Mon 28 Sep', in UTC so a calendar day never slips with the viewer's time zone. */
export function formatDay(dateString: string): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    }).formatToParts(new Date(`${dateString}T00:00:00.000Z`));
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

    return `${part("weekday")} ${part("day")} ${part("month")}`;
}

/** A whole number of 0 or more; anything else (blank, negative, decimal, text) is not a valid count. */
export function parseRequiredCount(input: string): number | null {
    const trimmed = input.trim();
    if (!/^\d+$/.test(trimmed)) return null;

    const count = Number(trimmed);
    return Number.isSafeInteger(count) ? count : null;
}

export interface GridCell {
    periodId: number;
    requirementId: number | null;
    requiredCount: number | null;
}

export interface GridRow {
    roleId: number;
    roleName: string;
    cells: GridCell[];
}

/** One row per role, one cell per period, in the periods' order. A cell with no requirement row is null, not 0. */
export function buildRequirementGrid(
    roles: Role[],
    periods: ShiftPeriodView[],
    requirements: CoverageRequirementView[],
): GridRow[] {
    const byRolePeriod = new Map(
        requirements.map((requirement) => [`${requirement.role.roleId}:${requirement.period.periodId}`, requirement]),
    );

    return [...roles]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((role) => ({
            roleId: role.roleId,
            roleName: role.name,
            cells: periods.map((period) => {
                const requirement = byRolePeriod.get(`${role.roleId}:${period.periodId}`);
                return {
                    periodId: period.periodId,
                    requirementId: requirement?.requirementId ?? null,
                    requiredCount: requirement?.requiredCount ?? null,
                };
            }),
        }));
}

export function sortPeriods(periods: ShiftPeriodView[]): ShiftPeriodView[] {
    return [...periods].sort((a, b) => a.sortOrder - b.sortOrder || a.defaultStart.localeCompare(b.defaultStart));
}

export interface WeeklyDay {
    shiftDate: string;
    required: number;
    scheduled: number;
    /** Positions still unfilled; 0 when fully staffed or over-staffed. */
    shortfall: number;
}

export interface WeeklyCoverageRow {
    roleName: string;
    periodName: string;
    days: WeeklyDay[];
}

/** Joins the raw gap rows with names and fills all seven days, ordered by role then period. */
export function buildWeeklyCoverage(
    gaps: CoverageGapRow[],
    roles: Role[],
    periods: ShiftPeriodView[],
    weekStart: string,
): WeeklyCoverageRow[] {
    const roleNames = new Map(roles.map((role) => [role.roleId, role.name]));
    const periodById = new Map(periods.map((period) => [period.periodId, period]));
    const dates = Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(weekStart, index));

    const groups = new Map<string, { roleId: number; periodId: number; byDate: Map<string, CoverageGapRow> }>();
    for (const gap of gaps) {
        const key = `${gap.roleId}:${gap.periodId}`;
        const group = groups.get(key) ?? { roleId: gap.roleId, periodId: gap.periodId, byDate: new Map() };
        group.byDate.set(gap.shiftDate, gap);
        groups.set(key, group);
    }

    return [...groups.values()]
        .map((group) => ({
            roleName: roleNames.get(group.roleId) ?? `Role ${group.roleId}`,
            period: periodById.get(group.periodId),
            periodId: group.periodId,
            days: dates.map((shiftDate): WeeklyDay => {
                const row = group.byDate.get(shiftDate);
                const required = row?.requiredCount ?? 0;
                const scheduled = row?.scheduledCount ?? 0;
                return { shiftDate, required, scheduled, shortfall: Math.max(0, required - scheduled) };
            }),
        }))
        .sort(
            (a, b) =>
                a.roleName.localeCompare(b.roleName) ||
                (a.period?.sortOrder ?? 0) - (b.period?.sortOrder ?? 0) ||
                a.periodId - b.periodId,
        )
        .map((row) => ({
            roleName: row.roleName,
            periodName: row.period?.name ?? `Period ${row.periodId}`,
            days: row.days,
        }));
}
