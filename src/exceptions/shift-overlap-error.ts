/**
 * A shift that would put one person in two places at once (-> 409).
 *
 * The clash is looked for across every branch, not just the one being scheduled: a worker who
 * covers two branches still only has one body.
 */
export class ShiftOverlapError extends Error {
    constructor(message = 'User already has a shift overlapping this time') {
        super(message)
        this.name = 'ShiftOverlapError'
    }
}
