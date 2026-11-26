import { AppError } from '@/exceptions/app-error'

export class RoleNotFoundError extends AppError {
    readonly code = 'ROLE_NOT_FOUND'

    constructor(message = 'Role not found') {
        super(message)
        this.name = 'RoleNotFoundError'
    }
}
