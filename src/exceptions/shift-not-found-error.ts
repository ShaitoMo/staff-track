export class ShiftNotFoundError extends Error {
    constructor(message = 'Shift not found') {
        super(message)
        this.name = 'ShiftNotFoundError'
    }
}
