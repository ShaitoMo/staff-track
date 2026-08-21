import { ForbiddenError } from '@/exceptions/forbidden-error'

/** The caller is authenticated but their role does not permit this action. */
export class InsufficientRoleError extends ForbiddenError {
    constructor(message = 'Your role does not permit this action') {
        super(message)
        this.name = 'InsufficientRoleError'
    }
}
