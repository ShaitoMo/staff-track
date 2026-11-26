import { AppError } from '@/exceptions/app-error'

export class InvalidTaskReferenceError extends AppError {
    readonly code = 'INVALID_TASK_REFERENCE'
    override readonly field = 'branch_section_id'

    constructor(message = 'The shelf-guide reference must be an active section, or folder in it, at this branch') {
        super(message)
        this.name = 'InvalidTaskReferenceError'
    }
}
