import { AppError } from '@/exceptions/app-error'

export class InvalidTaskAssignmentError extends AppError {
    readonly code = 'INVALID_TASK_ASSIGNMENT'
    override readonly field = 'assigned_to'

    constructor(message = 'Invalid assigned_to or assigned_role_id') {
        super(message)
        this.name = 'InvalidTaskAssignmentError'
    }
}
