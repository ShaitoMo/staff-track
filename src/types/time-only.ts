import { z } from 'zod';

/**
 * A wall-clock time of day, 'HH:MM', parsed to that time on 1970-01-01 UTC.
 *
 * Postgres `time` columns (shifts.start_time) carry no date, and Prisma reads and writes them
 * anchored at the epoch day in UTC. The anchor has to match the one already in use by the seed
 * and by ShiftRepository's formatter, or a parsed time would compare a day apart from a stored
 * one — which is exactly what the overlap query compares.
 *
 * The pattern admits only 00:00 through 23:59, so unlike DateOnlySchema there is no impossible
 * value left for a refine to catch.
 */
export const TimeOnlySchema = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be a time in HH:MM format, between 00:00 and 23:59')
    .transform((value) => new Date(`1970-01-01T${value}:00.000Z`));

/** Formats a `time` column back to 'HH:MM' for JSON responses — mirrors toDateOnlyString. */
export function toTimeOnlyString(time: Date): string {
    return time.toISOString().slice(11, 16);
}
