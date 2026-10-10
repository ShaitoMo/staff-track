import type { Branch } from "@/types/branch";
import type { ShiftPeriodView } from "@/types/shift-period";

export interface PeriodRow {
    periodId: number;
    name: string;
    /** '07:00–15:00' */
    hours: string;
    /** The branch's name, or "All branches" for a chain-wide period. */
    branchName: string;
    active: boolean;
    /** Chain-wide periods are the owner's to change; a manager sees them but can't edit them. */
    canChange: boolean;
}

/**
 * One list from each branch's periods. Every branch's list repeats the chain-wide periods, so
 * "All branches" would show them once per branch without the dedupe. Ordered the way the
 * schedule lists them: sort order, then start time.
 */
export function buildPeriodRows(periodsByBranch: ShiftPeriodView[][], branches: Branch[], isOwner: boolean): PeriodRow[] {
    const branchNames = new Map(branches.map((branch) => [branch.branchId, branch.name]));
    const unique = new Map(periodsByBranch.flat().map((period) => [period.periodId, period]));

    return [...unique.values()]
        .toSorted(
            (a, b) => a.sortOrder - b.sortOrder || a.defaultStart.localeCompare(b.defaultStart) || a.name.localeCompare(b.name),
        )
        .map((period) => ({
            periodId: period.periodId,
            name: period.name,
            hours: `${period.defaultStart}–${period.defaultEnd}`,
            branchName: period.branchId === null ? "All branches" : branchNames.get(period.branchId) ?? `Branch ${period.branchId}`,
            active: period.active,
            canChange: period.branchId !== null || isOwner,
        }));
}
