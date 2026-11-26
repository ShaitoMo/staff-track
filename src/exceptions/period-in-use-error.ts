import { AppError } from '@/exceptions/app-error'

/** A period a shift or coverage requirement still references (-> 409). Deletion never cascades. */
export class PeriodInUseError extends AppError {
    readonly code = 'PERIOD_IN_USE'

    constructor(message = "This period is used by shifts or coverage rules, so it can't be deleted. Deactivate it instead.") {
        super(message)
        this.name = 'PeriodInUseError'
    }
}
