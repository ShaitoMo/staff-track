import { AppError } from '@/exceptions/app-error'

export class ShiftPeriodNotFoundError extends AppError {
    readonly code = 'PERIOD_NOT_FOUND'

    constructor(message = 'Shift period not found') {
        super(message)
        this.name = 'ShiftPeriodNotFoundError'
    }
}
