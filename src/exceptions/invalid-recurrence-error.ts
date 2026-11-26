import { AppError } from '@/exceptions/app-error'

export class InvalidRecurrenceError extends AppError {
    readonly code = 'INVALID_RECURRENCE'
    override readonly field = 'recurrence'

    constructor(message = "Recurrence must be 'daily' or 'weekly:<days>' (e.g. 'weekly:mon,wed')") {
        super(message)
        this.name = 'InvalidRecurrenceError'
    }
}
