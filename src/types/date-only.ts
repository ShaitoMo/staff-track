import { z } from 'zod';

/**
 * A calendar day, 'YYYY-MM-DD', parsed to UTC midnight.
 *
 * Postgres `date` columns (task_instances.due_date) carry no timezone, and Prisma reads and
 * writes them at UTC midnight. Parsing with `new Date('2026-08-12')` would also give UTC, but
 * `new Date(2026, 7, 12)` would not — so the conversion is done in one place instead of
 * being re-derived per caller.
 */
export const DateOnlySchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
    .refine((value) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        // rejects impossible days that still match the shape, e.g. 2026-02-31
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }, 'Must be a real calendar date')
    .transform((value) => new Date(`${value}T00:00:00.000Z`));

/** Formats a Date back to 'YYYY-MM-DD' for JSON responses. */
export function toDateOnlyString(date: Date): string {
    return date.toISOString().slice(0, 10);
}
