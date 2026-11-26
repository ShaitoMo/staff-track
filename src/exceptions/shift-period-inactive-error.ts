import { AppError } from '@/exceptions/app-error'

/** A period that has been turned off can't be used for a new shift or coverage requirement (-> 400). */
export class ShiftPeriodInactiveError extends AppError {
    readonly code = 'PERIOD_INACTIVE'

    constructor(message = 'This shift period is turned off') {
        super(message)
        this.name = 'ShiftPeriodInactiveError'
    }
}
