import { AppError } from '@/exceptions/app-error'

export class UserNotFoundError extends AppError {
    readonly code = 'USER_NOT_FOUND'

    constructor(message = 'User not found') {
        super(message)
        this.name = 'UserNotFoundError'
    }
}
