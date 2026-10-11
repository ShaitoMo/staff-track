import { z } from 'zod';
import { DateOnlySchema } from './date-only';
import { TimestampSchema } from './timestamp';

export const CreateAttendanceSchema = z.object({
    user_id: z.number().int().positive(),
    branch_id: z.number().int().positive(),
    clock_in: TimestampSchema,
    clock_out: TimestampSchema.nullable().optional(),
}).superRefine((data, ctx) => {
    const { clock_in: clockIn, clock_out: clockOut } = data;

    // a timestamp that failed the format check never reaches here as a Date
    if (!(clockIn instanceof Date) || !(clockOut instanceof Date)) {
        return;
    }

    if (clockOut <= clockIn) {
        ctx.addIssue({
            code: 'custom',
            path: ['clock_out'],
            message: 'clock_out must be after clock_in',
        });
    }
});

export type CreateAttendanceInput = z.infer<typeof CreateAttendanceSchema>;

/**
 * PATCH /api/attendance/:id — fills in or corrects either end of a punch, typically the one the
 * machine missed. That the merged punch still ends after it starts is checked by the service,
 * since only it knows the end this request leaves untouched.
 */
export const UpdateAttendanceSchema = z.object({
    clock_in: TimestampSchema.optional(),
    clock_out: TimestampSchema.optional(),
}).refine((data) => data.clock_in !== undefined || data.clock_out !== undefined, {
    message: 'At least one of clock_in or clock_out must be provided',
});

export type UpdateAttendanceInput = z.infer<typeof UpdateAttendanceSchema>;

/**
 * Query parameters for GET /api/attendance.
 *
 * `from` and `to` are required, for the reason ScheduleVsActualFiltersSchema gives: this is a
 * report, always asked about a period, and an unbounded call would return every punch ever
 * recorded. They bound `clock_in` inclusively — or `clock_out`, for a punch with no clock-in.
 */
export const AttendanceFiltersSchema = z.object({
    user_id: z.coerce.number().int().positive().optional(),
    branch_id: z.coerce.number().int().positive().optional(),
    from: DateOnlySchema,
    to: DateOnlySchema,
}).superRefine((data, ctx) => {
    const { from, to } = data;

    // a date that failed the format check never reaches here as a Date
    if (!(from instanceof Date) || !(to instanceof Date)) {
        return;
    }

    if (to < from) {
        ctx.addIssue({
            code: 'custom',
            path: ['to'],
            message: 'to must be on or after from',
        });
    }
});

export type AttendanceFiltersInput = z.infer<typeof AttendanceFiltersSchema>;

// ---------- Response shape ----------

/** Mirrors the attendance_source enum; spelled out so this layer stays free of Prisma. */
export type AttendanceSource = 'csv_import' | 'machine' | 'manual';

export interface AttendanceView {
    attendance_id: number;
    user_id: number;
    branch_id: number;
    /** Null when the machine logged a clock-out with no clock-in — a punch waiting to be fixed. */
    clock_in: Date | null;
    clock_out: Date | null;
    source: AttendanceSource;
    import_batch_id: number | null;
}
