import { AppError } from '@/exceptions/app-error'

/**
 * A register that exists, but at some other branch than the shift's (-> 422).
 *
 * The composite FK (branch_id, register_id) already refuses this at the database, so this is
 * about the shape of the refusal, not the rule: it names the offending field instead of
 * surfacing a foreign-key violation.
 */
export class RegisterNotAtBranchError extends AppError {
    readonly code = 'REGISTER_NOT_AT_BRANCH'
    override readonly field = 'register_id'

    constructor(message = 'Register does not belong to this branch') {
        super(message)
        this.name = 'RegisterNotAtBranchError'
    }
}
