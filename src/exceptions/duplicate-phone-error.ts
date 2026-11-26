import { AppError } from '@/exceptions/app-error'

export class DuplicatePhoneError extends AppError {
    readonly code = 'DUPLICATE_PHONE'
    override readonly field = 'phone'

    constructor(message = 'User with this phone number already exists') {
        super(message)
        this.name = 'DuplicatePhoneError'
    }
}
