import { AppError } from '@/exceptions/app-error'

export class DuplicateUserBranchError extends AppError {
    readonly code = 'DUPLICATE_USER_BRANCH'

    constructor(message = 'User is already assigned to this branch') {
        super(message)
        this.name = 'DuplicateUserBranchError'
    }
}
