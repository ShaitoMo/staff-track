import { AppError } from '@/exceptions/app-error'

export class DuplicateRoleNameError extends AppError {
    readonly code = 'DUPLICATE_ROLE_NAME'
    override readonly field = 'name'

    constructor(message = 'Role with this name already exists') {
        super(message)
        this.name = 'DuplicateRoleNameError'
    }
}
