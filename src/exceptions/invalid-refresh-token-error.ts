import { AppError } from '@/exceptions/app-error'

export class InvalidRefreshTokenError extends AppError {
    readonly code = 'INVALID_REFRESH_TOKEN'

    constructor(message = 'Invalid or expired refresh token') {
        super(message)
        this.name = 'InvalidRefreshTokenError'
    }
}
