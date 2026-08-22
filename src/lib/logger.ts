import pino from 'pino';

/**
 * One logger for the whole app (pino/pino-pretty/thread-stream are on Next's
 * serverExternalPackages list, so no config change is needed). Dev fans out to a colorized console
 * target and a plain-text `logs/dev.log` (gitignored, no ANSI codes since it's read in an editor).
 * Production writes JSON to stdout only — the host's log capture handles retention.
 *
 * No redaction is configured, so callers are the only safeguard: never pass a request body,
 * password, or token into a log call, only the error object and identifiers.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'production'
        ? undefined
        : {
            targets: [
                {
                    target: 'pino-pretty',
                    options: { colorize: true, translateTime: 'yyyy-mm-dd HH:MM:ss' },
                },
                {
                    target: 'pino-pretty',
                    options: {
                        colorize: false,
                        translateTime: 'yyyy-mm-dd HH:MM:ss',
                        destination: './logs/dev.log',
                        mkdir: true,
                    },
                },
            ],
        },
});
