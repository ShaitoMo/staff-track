import { z } from 'zod';

/**
 * A wall-clock time of day, 'HH:MM', parsed to that time on 1970-01-01 UTC. Postgres `time`
 * columns carry no date, and Prisma anchors them at the epoch day in UTC — this matches the seed
 * and ShiftRepository's formatter, so a parsed time compares correctly against a stored one.
 */
export const TimeOnlySchema = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be a time in HH:MM format, between 00:00 and 23:59')
    .transform((value) => new Date(`1970-01-01T${value}:00.000Z`));
