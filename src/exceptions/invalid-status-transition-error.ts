import { AppError } from '@/exceptions/app-error'
import { TaskStatus } from '@/types/task-instance'

export class InvalidStatusTransitionError extends AppError {
    readonly code = 'INVALID_STATUS_TRANSITION'

    constructor(
        public readonly from: TaskStatus,
        public readonly to: TaskStatus,
    ) {
        super(`Cannot change task instance status from '${from}' to '${to}'`)
        this.name = 'InvalidStatusTransitionError'
    }
}
