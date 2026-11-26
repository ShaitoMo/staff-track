import { AppError } from '@/exceptions/app-error'

export class TaskNotFoundError extends AppError {
    readonly code = 'TASK_NOT_FOUND'

    constructor(message = 'Task not found') {
        super(message)
        this.name = 'TaskNotFoundError'
    }
}
