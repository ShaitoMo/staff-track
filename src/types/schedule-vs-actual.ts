import { z } from 'zod';
import { DateOnlySchema } from '@/types/date-only';

// ---------- Query filters (GET /api/schedule-vs-actual) ----------

/**
 * Query parameters for GET /api/schedule-vs-actual. `from`/`to` are required, unlike the open
 * shift endpoints — this is a report always asked about a period; unbounded would compare every
 * shift ever scheduled. Bound `shift_date` inclusively.
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
 * How a scheduled shift turned out. A punch with an end missing outranks timing — it needs fixing
 * before its timing means anything: `missing_clock_in` (the machine logged a clock-out with no
 * clock-in), then `missing_clock_out` (a punch still open after the shift ended). Then `late`
 * outranks `left_early` — the minute fields still carry the full story. A shift still running
 * with an open punch reads as `on_time`/`late` with a null `early_leave_minutes`.
 */
export type AttendanceFlag = 'on_time' | 'late' | 'left_early' | 'no_show' | 'missing_clock_in' | 'missing_clock_out';

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
    /** The punch behind a `missing_clock_in`/`missing_clock_out` flag, for fixing; null otherwise. */
    incomplete_attendance_id: number | null;
    /**
     * Signed minutes: positive arrived late, negative already present. Null on a no-show or a
     * missing clock-in. A large
     * negative value isn't an anomaly — it's a split day, the worker already on site from an
     * earlier shift.
     */
    late_minutes: number | null;
    /** Signed minutes: positive left early, negative stayed past the end. Null without a clock-out. */
    early_leave_minutes: number | null;
    /**
     * Arrived / left past the grace period, whatever the flag says — a late arrival who forgot to
     * clock out was still late, and a shift can be both. Counts read these, not the flag.
     */
    is_late: boolean;
    left_early: boolean;
}
