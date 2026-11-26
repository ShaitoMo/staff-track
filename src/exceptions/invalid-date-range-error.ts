import { AppError } from '@/exceptions/app-error'

export class InvalidDateRangeError extends AppError {
    readonly code = 'INVALID_DATE_RANGE'
    override readonly field = 'to'

    constructor(message = 'to must be on or after from') {
        super(message)
        this.name = 'InvalidDateRangeError'
    }
}
