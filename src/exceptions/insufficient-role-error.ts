import { ForbiddenError } from '@/exceptions/forbidden-error'

/** The caller is authenticated but their role does not permit this action. */
export class InsufficientRoleError extends ForbiddenError {
    override readonly code = 'INSUFFICIENT_ROLE'

    constructor(message = 'Your role does not permit this action') {
        super(message)
        this.name = 'InsufficientRoleError'
    }
}
