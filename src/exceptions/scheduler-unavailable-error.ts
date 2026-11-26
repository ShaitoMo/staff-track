import { AppError } from '@/exceptions/app-error'

/**
 * The auto-scheduler can't give a proposal (-> 503). `code` says why, so the manager is told
 * whether to set it up, try again later, or report it:
 * - SOLVER_NOT_CONFIGURED: its env vars are missing.
 * - SOLVER_UNAVAILABLE: unreachable, too slow, or failing on its side (5xx).
 * - SOLVER_CONTRACT_MISMATCH: it rejected our request (4xx) or answered outside the contract.
 */
export type SchedulerFailureCode = 'SOLVER_NOT_CONFIGURED' | 'SOLVER_UNAVAILABLE' | 'SOLVER_CONTRACT_MISMATCH'

export class SchedulerUnavailableError extends AppError {
    constructor(readonly code: SchedulerFailureCode, message = 'Auto-fill service unavailable') {
        super(message)
        this.name = 'SchedulerUnavailableError'
    }
}
