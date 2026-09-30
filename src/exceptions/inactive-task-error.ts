/**
 * A deactivated task's outstanding work is cancelled, so no new completions are accepted.
 *
 * Not a ForbiddenError: the caller may well be the right person: the task itself is closed,
 * which is a conflict with the resource's state (-> 409), not a permission problem.
 *
 * Review is deliberately *not* guarded this way. An instance already sitting in `completed`
 * when its task was deactivated still needs a path to verified or rejected.
 */
export class InactiveTaskError extends Error {
    constructor(message = 'This task is no longer active') {
        super(message)
        this.name = 'InactiveTaskError'
    }
}
