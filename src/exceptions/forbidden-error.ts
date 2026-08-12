/**
 * Base for every permission failure. Routes map `instanceof ForbiddenError` to 403 once,
 * while the subclasses keep the reason specific enough to be useful in the response body.
 */
export class ForbiddenError extends Error {
    constructor(message = 'Not permitted') {
        super(message)
        this.name = 'ForbiddenError'
    }
}

/** Completion is restricted to the person (or role, at that branch) the task targets. */
export class NotAssignedToTaskError extends ForbiddenError {
    constructor(message = 'Only the assignee may complete this task instance') {
        super(message)
        this.name = 'NotAssignedToTaskError'
    }
}

/** Review is restricted to managers of the branch the task belongs to. */
export class NotBranchManagerError extends ForbiddenError {
    constructor(message = 'Only a manager of this branch may review this task instance') {
        super(message)
        this.name = 'NotBranchManagerError'
    }
}

/** A completer may not verify or reject their own work. */
export class SelfReviewError extends ForbiddenError {
    constructor(message = 'You may not review a task instance you completed yourself') {
        super(message)
        this.name = 'SelfReviewError'
    }
}
