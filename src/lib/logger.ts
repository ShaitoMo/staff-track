import pino from 'pino';

/**
 * One logger for the whole app. `pino`/`pino-pretty`/`thread-stream` are all on Next's built-in
 * serverExternalPackages list, so no next.config.ts change is needed to keep them out of the
 * route-handler bundle.
 *
 * Dev fans out to two `pino-pretty` targets, same formatter both times (readable timestamp,
 * `INFO`/`ERROR` instead of the raw level number, stack traces on their own indented lines): one
 * colorized to the console as before, one plain-text to `logs/dev.log` (gitignored) — no ANSI
 * color codes there since that file gets opened in an editor, not a terminal, and escape codes
 * would just show up as garbage. Production writes JSON to stdout only — the host's own log
 * capture is the place for retention, not this repo.
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
