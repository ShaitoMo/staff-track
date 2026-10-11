export class InvalidDateRangeError extends Error {
    constructor(message = 'to must be on or after from') {
        super(message)
        this.name = 'InvalidDateRangeError'
    }
}
