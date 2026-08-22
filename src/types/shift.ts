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
 * POST /api/shifts.
 *
 * `register_id` is optional and nullable — a shift only names a register when it is a cashier's
 * (the column is NULL otherwise), and the register must belong to `branch_id`, which the service
 * checks because only it can read the register.
 *
 * `period_id` is optional. When given, `start_time`/`end_time` are inherited from that period's
 * defaults — the service copies them onto the row (see ShiftService.createShift) rather than
 * reading them through the relation later, so a request naming `period_id` must not also send its
 * own times: the two sources would silently disagree about which one wins. When `period_id` is
 * absent, `start_time`/`end_time` come from the request exactly as before, and both are required.
 *
 * `created_by` is the manager doing the scheduling. It is session-derived, not a request field —
 * the route merges it in after this schema validates the rest, matching CreateTaskSchema's
 * `assigned_by`.
 *
 * `end_time` must be strictly after `start_time`. A shift is therefore one span inside its own
 * `shift_date`, and an overnight shift is scheduled as two rows on two dates — which is what lets
 * the double-booking check stay a plain interval comparison within a single day.
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
 * PATCH /api/shifts/:shiftId.
 *
 * An absent field means 'leave it alone', so `register_id: null` is the only way to clear a
 * register — and the only field where null and absent differ.
 *
 * `user_id` is editable — handing a shift to a colleague keeps the slot and its history rather
 * than replacing it — and it re-asks both questions that name a worker: whether the new one works
 * at the shift's branch, and whether they are already booked over these hours.
 *
 * `created_by` is not editable: it records who scheduled the shift, not who last touched it.
 *
 * `start_time` and `end_time` must be sent together, for the reason UpdateTaskSchema pairs
 * `is_recurring` with `recurrence`: sent alone, neither describes the resulting span — the other
 * half lives in the database — so ordering could not be judged here and would have to be
 * discovered after a read. Sent as a pair, the span is fully described by the request and a
 * backwards one is refused with a 400 naming the field.
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
