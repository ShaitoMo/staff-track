/** A period a shift or coverage requirement still references (-> 409). Deletion never cascades. */
export class PeriodInUseError extends Error {
    constructor(message = 'Shift period is still referenced by a shift or coverage requirement') {
        super(message)
        this.name = 'PeriodInUseError'
    }
}
