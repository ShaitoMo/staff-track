/**
 * A period that exists, but is scoped to some other branch than the one it's being used for
 * (-> 400).
 *
 * There is no composite FK to lean on here: shift_periods.branch_id is nullable so a global period
 * can attach to any branch, which MATCH SIMPLE can't express as "same branch, or NULL". The check
 * is app-level instead — see ShiftService.assertPeriodAtBranch and
 * CoverageRequirementService.assertPeriodAtBranch.
 */
export class ShiftPeriodNotAtBranchError extends Error {
    constructor(message = 'Shift period does not belong to this branch') {
        super(message)
        this.name = 'ShiftPeriodNotAtBranchError'
    }
}
