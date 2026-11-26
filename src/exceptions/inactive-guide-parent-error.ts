import { AppError } from '@/exceptions/app-error'

export class InactiveGuideParentError extends AppError {
    readonly code = 'INACTIVE_GUIDE_PARENT'

    constructor(message = 'Reactivate the section or parent folder first') {
        super(message)
        this.name = 'InactiveGuideParentError'
    }
}
