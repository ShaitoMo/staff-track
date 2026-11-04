/** The auto-scheduler service is unreachable, misconfigured, too slow, or answered with something unusable. */
export class SchedulerUnavailableError extends Error {
    constructor(message = 'Auto-fill service unavailable') {
        super(message)
        this.name = 'SchedulerUnavailableError'
    }
}
