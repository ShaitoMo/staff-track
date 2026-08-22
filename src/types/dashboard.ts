import { z } from 'zod';
import { DateOnlySchema } from '@/types/date-only';

// ---------- Query filters (GET /api/dashboard) ----------

/**
 * `branch_id`, `from` and `to` are all optional: omitting `branch_id` is the all-branches view
 * (owner only, enforced at the route), and omitting `from`/`to` defaults the range to today —
 * a dashboard answers "how are we doing right now" as often as "how did we do over a range".
 */
export const DashboardFiltersSchema = z.object({
    branch_id: z.coerce.number().int().positive().optional(),
    from: DateOnlySchema.optional(),
    to: DateOnlySchema.optional(),
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

export type DashboardFiltersInput = z.infer<typeof DashboardFiltersSchema>;

// ---------- Response shape ----------

/**
 * One row per branch: how many scheduled shifts in the range were actually worked. Named
 * `attendance_coverage`, not `coverage` — distinct from `GET /branches/:id/coverage`'s
 * required-vs-scheduled staffing question. `shifts_covered` counts anything but `no_show` (late/
 * left-early still count). One row per branch in scope, including branches with zero shifts.
 */
export interface AttendanceCoverageRow {
    branch_id: number;
    shifts_scheduled: number;
    shifts_covered: number;
}

/** GET /api/dashboard response (FR11). Attendance and tasks are totals across whatever branches are in scope; attendance_coverage breaks those same shifts down per branch. */
export interface DashboardResponse {
    branch_id: number | null;
    range: {
        from: string;
        to: string;
    };
    attendance: {
        no_shows: number;
        late_arrivals: number;
        early_departures: number;
    };
    tasks: {
        pending: number;
        completed: number;
        verified: number;
        rejected: number;
    };
    attendance_coverage: AttendanceCoverageRow[];
}
