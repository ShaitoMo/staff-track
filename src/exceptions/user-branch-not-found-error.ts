import { AppError } from '@/exceptions/app-error'

export class UserBranchNotFoundError extends AppError {
    readonly code = 'USER_BRANCH_NOT_FOUND'

    constructor(message = 'User is not assigned to this branch') {
        super(message)
        this.name = 'UserBranchNotFoundError'
    }
}
