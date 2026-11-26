import { SchedulerFailureCode, SchedulerUnavailableError } from '@/exceptions/scheduler-unavailable-error'
import { logger } from '@/lib/logger'
import { SolverRequest, SolverResponse, SolverResponseSchema } from '@/types/schedule-builder'

/** The solver stops itself at 10 s; the rest is transport. */
const TIMEOUT_MS = 20_000

/**
 * Calls the OR-Tools service in scheduler/. Every way it can fail is a SchedulerUnavailableError
 * whose code names the kind (see that class), so the route answers a clean 503 and the cause goes
 * to the log only. The env vars are read per call, so importing this in tests needs no env.
 */
export async function solveSchedule(request: SolverRequest): Promise<SolverResponse> {
    const url = process.env.SCHEDULER_URL
    const secret = process.env.SCHEDULER_SECRET

    if (!url || !secret) {
        throw new SchedulerUnavailableError('SOLVER_NOT_CONFIGURED', 'Auto-fill service is not configured')
    }

    let res: Response

    try {
        res = await fetch(`${url}/solve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Scheduler-Secret': secret },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
    } catch (error) {
        logger.error({ err: error }, 'Scheduler request failed')
        throw new SchedulerUnavailableError('SOLVER_UNAVAILABLE')
    }

    if (!res.ok) {
        logger.error({ status: res.status }, 'Scheduler answered with an error status')
        throw new SchedulerUnavailableError(failureForStatus(res.status))
    }

    let body: unknown

    try {
        body = await res.json()
    } catch (error) {
        // the timeout also covers reading the body, and running out of time isn't a bad reply
        const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
        logger.error({ err: error }, timedOut ? 'Scheduler reply timed out' : 'Scheduler response was not JSON')
        throw new SchedulerUnavailableError(timedOut ? 'SOLVER_UNAVAILABLE' : 'SOLVER_CONTRACT_MISMATCH')
    }

    const parsed = SolverResponseSchema.safeParse(body)

    if (!parsed.success) {
        logger.error({ err: parsed.error }, 'Scheduler response did not match the contract')
        throw new SchedulerUnavailableError('SOLVER_CONTRACT_MISMATCH')
    }

    return parsed.data
}

/**
 * 401/403: it refused our secret, so the setup is wrong. Any other 4xx: it refused what we sent.
 * A 5xx is its own trouble and may pass.
 */
function failureForStatus(status: number): SchedulerFailureCode {
    if (status === 401 || status === 403) return 'SOLVER_NOT_CONFIGURED'
    return status < 500 ? 'SOLVER_CONTRACT_MISMATCH' : 'SOLVER_UNAVAILABLE'
}
