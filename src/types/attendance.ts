import {z} from 'zod';
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



export const AttendanceFiltersSchema = z.object({
    user_id: z.coerce.number().int().positive().optional(),
    branch_id: z.coerce.number().int().positive().optional(),
    from: DateOnlySchema.optional(),
    to: DateOnlySchema.optional(),
});

export type AttendanceFiltersInput = z.infer<typeof AttendanceFiltersSchema>;

// ---------- Response shape ----------

/** Mirrors the attendance_source enum; spelled out so this layer stays free of Prisma. */
export type AttendanceSource = 'csv_import' | 'machine' | 'manual';

export interface AttendanceView {
    attendance_id: number;
    user_id: number;
    branch_id: number;
    clock_in: Date;
    clock_out: Date | null;
    source: AttendanceSource;
    import_batch_id: number | null;
}