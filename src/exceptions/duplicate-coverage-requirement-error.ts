/** A second row for the same (branch, role, period) (-> 409). Never silently upserted. */
export class DuplicateCoverageRequirementError extends Error {
    constructor(message = 'A coverage requirement for this branch, role, and period already exists') {
        super(message)
        this.name = 'DuplicateCoverageRequirementError'
    }
}
