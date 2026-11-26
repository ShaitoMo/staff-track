import { AppError } from '@/exceptions/app-error'

export class RegisterNotFoundError extends AppError {
    readonly code = 'REGISTER_NOT_FOUND'

    constructor(message = 'Register not found') {
        super(message)
        this.name = 'RegisterNotFoundError'
    }
}
