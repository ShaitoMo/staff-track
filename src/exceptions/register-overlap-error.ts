/**
 * A shift that would put a second person on a register someone already holds at that time (-> 409).
 * A register is one checkout station, so only one person can work it at once.
 */
export class RegisterOverlapError extends Error {
    constructor(message = 'Register already has a shift overlapping this time') {
        super(message)
        this.name = 'RegisterOverlapError'
    }
}
