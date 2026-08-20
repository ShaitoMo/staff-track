import { z } from 'zod';
import { ImportRowError } from '@/lib/attendance-import';

/**
 * The non-file half of POST /api/attendance/import.
 *
 * `branch_id` is required because the machine's employee numbers are only unique within a branch
 * (`user_branches.machine_employee_id`) — the same '60' can be two people at two branches, so the
 * file alone cannot say who it is about.
 */
export const ImportAttendanceSchema = z.object({
    branch_id: z.coerce.number().int().positive(),
});

/** imported_by is session-derived — the route merges it in after ImportAttendanceSchema validates the rest. */
export type ImportAttendanceInput = z.infer<typeof ImportAttendanceSchema> & { imported_by: number };

export interface ImportAttendanceResult {
    batch_id: number;
    file_name: string;
    /** punches read out of the file, before anything was matched or written */
    punches_read: number;
    records_created: number;
    /** already recorded — the re-upload case, refused by the (user_id, clock_in) constraint */
    records_skipped: number;
    errors: ImportRowError[];
}
