import pino from 'pino';

/**
 * One logger for the whole app. `pino`/`pino-pretty`/`thread-stream` are all on Next's built-in
 * serverExternalPackages list, so no next.config.ts change is needed to keep them out of the
 * route-handler bundle.
 *
 * Dev fans out to two targets: the pretty console (as before) and a plain-JSON file under
 * `logs/`, gitignored, so a session's output survives after the terminal scrolls away. Production
 * writes JSON to stdout only — the host's own log capture is the place for retention, not this repo.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'production'
        ? undefined
        : {
            targets: [
                { target: 'pino-pretty', options: { colorize: true } },
                { target: 'pino/file', options: { destination: './logs/dev.log', mkdir: true } },
            ],
        },
});
