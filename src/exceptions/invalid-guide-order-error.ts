import { AppError } from '@/exceptions/app-error'

export class InvalidGuideOrderError extends AppError {
    readonly code = 'INVALID_GUIDE_ORDER'

    constructor(message = 'The order must list exactly the photos at this level') {
        super(message)
        this.name = 'InvalidGuideOrderError'
    }
}
