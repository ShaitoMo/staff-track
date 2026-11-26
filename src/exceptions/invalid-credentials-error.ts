import { AppError } from '@/exceptions/app-error'

export class InvalidCredentialsError extends AppError {
    readonly code = 'INVALID_CREDENTIALS'

    constructor(message = 'Invalid phone or password') {
        super(message)
        this.name = 'InvalidCredentialsError'
    }
}
