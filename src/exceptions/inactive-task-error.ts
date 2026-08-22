/**
 * A deactivated task's outstanding work is cancelled — no new completions accepted. Not a
 * ForbiddenError: the task itself is closed (-> 409 conflict), not a permission problem. Review
 * is deliberately not guarded this way, since an instance already `completed` still needs a path
 * to verified/rejected.
 */
export class InactiveTaskError extends Error {
    constructor(message = 'This task is no longer active') {
        super(message)
        this.name = 'InactiveTaskError'
    }
}
