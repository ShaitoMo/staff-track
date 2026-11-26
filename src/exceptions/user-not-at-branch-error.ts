import { AppError } from '@/exceptions/app-error'

/** `field` is the request field naming the user: `user_id` on a shift or punch, `assigned_to` on a task. */
export class UserNotAtBranchError extends AppError {
    readonly code = 'USER_NOT_AT_BRANCH'

    constructor(override readonly field: 'user_id' | 'assigned_to', message = 'Assigned user does not work at this branch') {
        super(message)
        this.name = 'UserNotAtBranchError'
    }
}
