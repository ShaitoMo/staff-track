import { AppError } from '@/exceptions/app-error'

export class BranchNotFoundError extends AppError {
    readonly code = 'BRANCH_NOT_FOUND'

    constructor(message = 'Branch not found') {
        super(message)
        this.name = 'BranchNotFoundError'
    }
}
