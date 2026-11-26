import { AppError } from '@/exceptions/app-error'

export class ShiftNotFoundError extends AppError {
    readonly code = 'SHIFT_NOT_FOUND'

    constructor(message = 'Shift not found') {
        super(message)
        this.name = 'ShiftNotFoundError'
    }
}
