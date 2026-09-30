import { z } from 'zod';
import { DateOnlySchema } from '@/types/date-only';

// ---------- Query filters (GET /api/schedule-vs-actual) ----------

/**
 * Query parameters for GET /api/schedule-vs-actual.
 *
 * `from` and `to` are required, unlike the shift endpoints where the bounds stay open: this is a
 * report, always asked about a period, and an unbounded call would compare every shift ever
 * scheduled at every branch. They bound `shift_date` inclusively.
 */
export const ScheduleVsActualFiltersSchema = z.object({
    branch_id: z.coerce.number().int().positive().optional(),
    user_id: z.coerce.number().int().positive().optional(),
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

export type ScheduleVsActualFiltersInput = z.infer<typeof ScheduleVsActualFiltersSchema>;

// ---------- Response shape ----------

/**
 * How a scheduled shift turned out.
 *
 * `late` outranks `left_early` when both are true — the two minute fields still carry the whole
 * story, so nothing is lost by the flag naming only the worse half. `left_early` needs a
 * clock-out; a shift still open at the time of the report reads as `on_time` or `late` with a null
 * `early_leave_minutes`.
 */
export type AttendanceFlag = 'on_time' | 'late' | 'left_early' | 'no_show';

/** One row per scheduled shift compared to attendance (FR6). */
export interface ScheduleVsActualRow {
    shift_id: number;
    user_id: number;
    branch_id: number;
    shift_date: string;
    scheduled_start: string;
    scheduled_end: string;
    actual_clock_in: Date | null;
    actual_clock_out: Date | null;
    flag: AttendanceFlag;
    /**
     * Signed minutes: positive arrived late, negative already present. Null on a no-show.
     *
     * A large negative value is not an anomaly — it means the worker was on site from an earlier
     * shift the same day and never left, which is what a split day looks like from here.
     */
    late_minutes: number | null;
    /** Signed minutes: positive left early, negative stayed past the end. Null without a clock-out. */
    early_leave_minutes: number | null;
}
