import { z } from 'zod';
import { DateOnlySchema } from '@/types/date-only';
import { TimeOnlySchema } from '@/types/time-only';

// ---------- Query filters (GET /api/shifts) ----------

/**
 * Query parameters for GET /api/shifts. They arrive as strings, so ids are coerced here
 * rather than in the route. Every filter is optional and they combine with AND;
 * `from`/`to` bound shift_date inclusively.
 */
export const ShiftFiltersSchema = z.object({
    branch_id: z.coerce.number().int().positive().optional(),
    user_id: z.coerce.number().int().positive().optional(),
    register_id: z.coerce.number().int().positive().optional(),
    from: DateOnlySchema.optional(),
    to: DateOnlySchema.optional(),
});

export type ShiftFiltersInput = z.infer<typeof ShiftFiltersSchema>;

/**
 * GET /api/users/:userId/shifts takes the same date window, but the user comes from the path
 * rather than the query — so the id filters are dropped instead of being restated here.
 */
export const UserShiftFiltersSchema = ShiftFiltersSchema.pick({ from: true, to: true });

export type UserShiftFiltersInput = z.infer<typeof UserShiftFiltersSchema>;

// ---------- Creation (POST /api/shifts) ----------

/**
 * POST /api/shifts. `register_id` must belong to `branch_id` (service-checked). `period_id`, if
 * given, supplies `start_time`/`end_time` from its defaults — omit your own, they'd silently
 * conflict; without `period_id`, both times are required. `created_by` is session-derived, not
 * client-supplied. `end_time` must be strictly after `start_time`, so an overnight shift is two
 * rows on two dates, keeping the overlap check a same-day interval compare.
 */
export const CreateShiftSchema = z.object({
    user_id: z.number().int().positive(),
    branch_id: z.number().int().positive(),
    register_id: z.number().int().positive().nullable().optional(),
    period_id: z.number().int().positive().optional(),
    shift_date: DateOnlySchema,
    start_time: TimeOnlySchema.optional(),
    end_time: TimeOnlySchema.optional(),
}).superRefine((data, ctx) => {
    const { start_time: startTime, end_time: endTime, period_id: periodId } = data;

    if (periodId !== undefined) {
        if (startTime !== undefined || endTime !== undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['period_id'],
                message: 'start_time/end_time are inherited from period_id and must not be sent with it',
            });
        }
        return;
    }

    if (startTime === undefined || endTime === undefined) {
        ctx.addIssue({
            code: 'custom',
            path: [startTime === undefined ? 'start_time' : 'end_time'],
            message: 'start_time and end_time are required when period_id is not given',
        });
        return;
    }

    // A time that failed the format check never reaches here as a Date: Zod stops at the failed
    // string check and leaves the key absent, whatever the inferred type claims. Ordering has
    // nothing to say about that, and reporting it anyway would blame end_time for a typo in
    // start_time.
    if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
        return;
    }

    if (endTime <= startTime) {
        ctx.addIssue({
            code: 'custom',
            path: ['end_time'],
            message: 'end_time must be after start_time',
        });
    }
});

/** created_by is session-derived — the route merges it in after CreateShiftSchema validates the rest. */
export type CreateShiftInput = z.infer<typeof CreateShiftSchema> & { created_by: number };

// ---------- Editing (PATCH /api/shifts/:shiftId) ----------

/**
 * PATCH /api/shifts/:shiftId. Absent means 'leave it alone' — `register_id: null` is the only way
 * to clear one. `user_id` is editable (re-checks branch membership and overlap for the new worker).
 * `created_by` is not editable — it records who scheduled, not who last touched. `start_time`/
 * `end_time` must be sent together, since either alone can't be validated against the half still
 * in the database.
 */
export const UpdateShiftSchema = z.object({
    user_id: z.number().int().positive().optional(),
    branch_id: z.number().int().positive().optional(),
    register_id: z.number().int().positive().nullable().optional(),
    shift_date: DateOnlySchema.optional(),
    start_time: TimeOnlySchema.optional(),
    end_time: TimeOnlySchema.optional(),
}).refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'At least one field must be provided',
}).superRefine((data, ctx) => {
    const { start_time: startTime, end_time: endTime } = data;

    if (startTime === undefined && endTime === undefined) {
        return;
    }

    if (startTime === undefined || endTime === undefined) {
        ctx.addIssue({
            code: 'custom',
            path: [startTime === undefined ? 'start_time' : 'end_time'],
            message: 'Send start_time and end_time together: neither describes the resulting span on its own',
        });
        return;
    }

    // see CreateShiftSchema: a time that failed the format check never arrives here as a Date
    if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
        return;
    }

    if (endTime <= startTime) {
        ctx.addIssue({
            code: 'custom',
            path: ['end_time'],
            message: 'end_time must be after start_time',
        });
    }
});

export type UpdateShiftInput = z.infer<typeof UpdateShiftSchema>;

// ---------- Copying a week (POST /api/shifts/copy-week) ----------

/**
 * POST /api/shifts/copy-week. Copies one branch's shifts from the seven days before `week_start`
 * onto the seven days from it, same people, periods, registers and hours. `week_start` is not
 * forced to a Monday — the schedule page always sends one, and any 7-day window copies the same way.
 */
export const CopyWeekSchema = z.object({
    branch_id: z.number().int().positive(),
    week_start: DateOnlySchema,
});

export type CopyWeekInput = z.infer<typeof CopyWeekSchema>;

/** `skipped` counts source shifts left out: the person clashes, left the branch, or is inactive. */
export interface CopyWeekResult {
    created: number;
    skipped: number;
}

// ---------- A branch's week, readable by its staff (GET /api/branches/:branchId/schedule) ----------

/** Always one 7-day window from `week_start`, so a read stays bounded whoever asks. */
export const BranchScheduleQuerySchema = z.object({
    week_start: DateOnlySchema,
});

export type BranchScheduleQueryInput = z.infer<typeof BranchScheduleQuerySchema>;

/**
 * One shift as any member of the branch may see it: names already resolved, nothing about the
 * person beyond name and role (no phone, no active flag), nothing about who scheduled it.
 */
export interface BranchScheduleShift {
    shift_id: number;
    user_id: number;
    user_name: string;
    role_name: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    period_id: number | null;
    register_name: string | null;
}

export interface BranchScheduleView {
    branch_id: number;
    branch_name: string;
    /** In schedule order (sort order, then name). */
    periods: { period_id: number; name: string }[];
    shifts: BranchScheduleShift[];
}


export interface ShiftView {
    shift_id: number;
    user_id: number;
    branch_id: number;
    register_id: number | null;
    period_id: number | null;
    shift_date: string;
    start_time: string;
    end_time: string;
    created_by: number;
    created_at: Date;
    updated_at: Date;
}
