import { SchedulerUnavailableError } from '@/exceptions/scheduler-unavailable-error'
import { logger } from '@/lib/logger'
import { SolverRequest, SolverResponse, SolverResponseSchema } from '@/types/schedule-builder'

/** The solver stops itself at 10 s; the rest is transport. */
const TIMEOUT_MS = 20_000

/**
 * Calls the OR-Tools service in scheduler/. Every way it can fail (env vars missing, network
 * error, timeout, non-2xx, a body that isn't the contract) is one SchedulerUnavailableError, so the
 * route answers a clean 503 and the cause goes to the log only. The env vars are read per call,
 * so importing this in tests needs no env.
 */
export async function solveSchedule(request: SolverRequest): Promise<SolverResponse> {
    const url = process.env.SCHEDULER_URL
    const secret = process.env.SCHEDULER_SECRET

    if (!url || !secret) {
        throw new SchedulerUnavailableError('Auto-fill service is not configured')
    }

    let body: unknown

    try {
        const res = await fetch(`${url}/solve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Scheduler-Secret': secret },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })

        if (!res.ok) {
            throw new Error(`scheduler answered ${res.status}`)
        }

        body = await res.json()
    } catch (error) {
        logger.error({ err: error }, 'Scheduler request failed')
        throw new SchedulerUnavailableError()
    }

    const parsed = SolverResponseSchema.safeParse(body)

    if (!parsed.success) {
        logger.error({ err: parsed.error }, 'Scheduler response did not match the contract')
        throw new SchedulerUnavailableError()
    }

    return parsed.data
}
