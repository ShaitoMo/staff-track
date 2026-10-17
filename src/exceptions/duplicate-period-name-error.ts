/** A period name already taken at that branch, or among the chain-wide periods (-> 409). */
export class DuplicatePeriodNameError extends Error {
    constructor(message = 'A period with this name already exists') {
        super(message)
        this.name = 'DuplicatePeriodNameError'
    }
}
