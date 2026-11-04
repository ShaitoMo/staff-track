import { blockReason } from "@/lib/scheduling-rules";
import type { ProposalEmployee, ProposedShift, ScheduleProposal, UnfilledSlot } from "@/types/schedule-builder";
import type { ShiftPeriodView } from "@/types/shift-period";

/** A proposed shift as the preview edits it. `id` is fixed when the proposal arrives, so a swap keeps the row in place. */
export interface ProposalRow extends ProposedShift {
    id: number;
}

export interface ProposalPeriodGroup {
    period: ShiftPeriodView;
    rows: ProposalRow[];
    unfilled: UnfilledSlot[];
}

export interface ProposalDay {
    date: string;
    periods: ProposalPeriodGroup[];
}

export function toRows(assignments: ProposedShift[]): ProposalRow[] {
    return assignments.map((shift, id) => ({ ...shift, id }));
}

/**
 * Who `row` could go to instead: someone in the slot's role whom nothing blocks there given the
 * proposal's other rows (see `blockReason`). The current person is always in the list, so it can be
 * the selected value.
 */
export function swapCandidates(
    proposal: Pick<ScheduleProposal, "employees" | "maxShiftsPerWeek">,
    rows: ProposalRow[],
    row: ProposalRow,
): ProposalEmployee[] {
    const others = rows.filter((other) => other.id !== row.id);

    return proposal.employees.filter((employee) =>
        employee.userId === row.userId
        || (employee.roleId === row.roleId && blockReason(employee, row, others, proposal.maxShiftsPerWeek) === null));
}

/**
 * The preview's layout: days in order, each with the periods that have something to show, in the
 * schedule's own period order. A period with neither a proposed row nor an unfilled slot is left
 * out, and so is a day with no periods left.
 */
export function groupByDay(rows: ProposalRow[], unfilled: UnfilledSlot[], periods: ShiftPeriodView[]): ProposalDay[] {
    const dates = [...new Set([...rows, ...unfilled].map((item) => item.shiftDate))].toSorted();

    return dates
        .map((date) => ({
            date,
            periods: periods
                .map((period) => ({
                    period,
                    rows: rows.filter((row) => row.shiftDate === date && row.periodId === period.periodId),
                    unfilled: unfilled.filter((slot) => slot.shiftDate === date && slot.periodId === period.periodId),
                }))
                .filter((group) => group.rows.length > 0 || group.unfilled.length > 0),
        }))
        .filter((day) => day.periods.length > 0);
}

/** How many of the solver's rows the manager has removed or given to someone else. */
export function countChanges(proposal: Pick<ScheduleProposal, "assignments">, rows: ProposalRow[]): number {
    const original = toRows(proposal.assignments);
    const removed = original.length - rows.length;
    const swapped = rows.filter((row) => original[row.id]?.userId !== row.userId).length;

    return removed + swapped;
}

/**
 * Why a slot stayed short, judged from the people who hold its role:
 * - `noRole`: nobody at the branch holds it
 * - `busy`: everyone who does already works that day
 * - `cap` / `rule` / `capOrRule`: of those free that day, every one is at the weekly cap, kept out
 *   by a scheduling rule, or a mix of the two
 * - `null`: someone could still take it (a row was removed after the solver answered)
 */
export type ShortReason = "noRole" | "busy" | "cap" | "rule" | "capOrRule";

export function shortReason(
    proposal: Pick<ScheduleProposal, "employees" | "maxShiftsPerWeek">,
    rows: ProposalRow[],
    slot: UnfilledSlot,
): ShortReason | null {
    const holders = proposal.employees.filter((employee) => employee.roleId === slot.roleId);
    if (holders.length === 0) return "noRole";

    const reasons = holders.map((employee) => blockReason(employee, slot, rows, proposal.maxShiftsPerWeek));
    if (reasons.includes(null)) return null;

    const cap = reasons.includes("cap");
    const rule = reasons.includes("rule");
    if (!cap && !rule) return "busy";
    return cap && rule ? "capOrRule" : cap ? "cap" : "rule";
}
