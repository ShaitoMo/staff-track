import { ForbiddenError } from '@/exceptions/forbidden-error'

/** The caller's role is right, but this branch is not one of theirs (owner bypasses this). */
export class BranchAccessDeniedError extends ForbiddenError {
    constructor(message = 'You do not have access to this branch') {
        super(message)
        this.name = 'BranchAccessDeniedError'
    }
}
