export class InvalidRecurrenceError extends Error {
    constructor(message = "Recurrence must be 'daily' or 'weekly:<days>' (e.g. 'weekly:mon,wed')") {
        super(message)
        this.name = 'InvalidRecurrenceError'
    }
}
