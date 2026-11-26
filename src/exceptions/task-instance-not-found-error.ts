import { AppError } from '@/exceptions/app-error'

export class TaskInstanceNotFoundError extends AppError {
    readonly code = 'TASK_INSTANCE_NOT_FOUND'

    constructor(message = 'Task instance not found') {
        super(message)
        this.name = 'TaskInstanceNotFoundError'
    }
}
