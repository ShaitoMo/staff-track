import { AppError } from '@/exceptions/app-error'

export class InvalidRoleError extends AppError {
    readonly code = 'INVALID_ROLE'
    override readonly field = 'roleId'

    constructor(message = 'Invalid roleId') {
        super(message)
        this.name = 'InvalidRoleError'
    }
}
