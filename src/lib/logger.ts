import pino from 'pino';

/**
 * One logger for the whole app. `pino`/`pino-pretty`/`thread-stream` are all on Next's built-in
 * serverExternalPackages list, so no next.config.ts change is needed to keep them out of the
 * route-handler bundle.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true } },
});
