import { AppError } from '@/exceptions/app-error'

/**
 * Base for every permission failure. Routes map `instanceof ForbiddenError` to 403 once,
 * while the subclasses keep the reason specific enough to be useful in the response body.
 */
export class ForbiddenError extends AppError {
    readonly code: string = 'FORBIDDEN'

    constructor(message = 'Not permitted') {
        super(message)
        this.name = 'ForbiddenError'
    }
}

/** Completion is restricted to the person (or role, at that branch) the task targets. */
export class NotAssignedToTaskError extends ForbiddenError {
    override readonly code = 'NOT_ASSIGNEE'

    constructor(message = 'Only the assignee may complete this task instance') {
        super(message)
        this.name = 'NotAssignedToTaskError'
    }
}

/** Review is restricted to managers of the branch the task belongs to. */
export class NotBranchManagerError extends ForbiddenError {
    override readonly code = 'NOT_BRANCH_MANAGER'

    constructor(message = 'Only a manager of this branch may review this task instance') {
        super(message)
        this.name = 'NotBranchManagerError'
    }
}

/** A completer may not verify or reject their own work. */
export class SelfReviewError extends ForbiddenError {
    override readonly code = 'SELF_REVIEW'

    constructor(message = 'You may not review a task instance you completed yourself') {
        super(message)
        this.name = 'SelfReviewError'
    }
}

/** Changing roleId always requires acting on someone else, even for an owner. */
export class SelfRoleChangeError extends ForbiddenError {
    override readonly code = 'SELF_ROLE_CHANGE'
    override readonly field = 'roleId'

    constructor(message = 'You may not change your own role') {
        super(message)
        this.name = 'SelfRoleChangeError'
    }
}

/** Changing isActive always requires acting on someone else, even for an owner. */
export class SelfStatusChangeError extends ForbiddenError {
    override readonly code = 'SELF_STATUS_CHANGE'
    override readonly field = 'isActive'

    constructor(message = 'You may not change your own active status') {
        super(message)
        this.name = 'SelfStatusChangeError'
    }
}
