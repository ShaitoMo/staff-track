/**
 * A period that exists, but is scoped to a different branch (-> 400). No composite FK to lean on:
 * `shift_periods.branch_id` is nullable (a global period), which MATCH SIMPLE can't express as
 * "same branch, or NULL" — checked app-level instead, see ShiftService/CoverageRequirementService's
 * assertPeriodAtBranch.
 */
export class ShiftPeriodNotAtBranchError extends Error {
    constructor(message = 'Shift period does not belong to this branch') {
        super(message)
        this.name = 'ShiftPeriodNotAtBranchError'
    }
}
