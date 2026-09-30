export class ShiftPeriodNotFoundError extends Error {
    constructor(message = 'Shift period not found') {
        super(message)
        this.name = 'ShiftPeriodNotFoundError'
    }
}
