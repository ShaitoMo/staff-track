import { z } from 'zod';
import { ImportRowError } from '@/lib/attendance-import';

/**
 * The non-file half of POST /api/attendance/import.
 *
 * `branch_id` is required because the machine's employee numbers are only unique within a branch
 * (`user_branches.machine_employee_id`) — the same '60' can be two people at two branches, so the
 * file alone cannot say who it is about.
 *
 * `imported_by` is the manager doing the upload; a request field only until authentication exists,
 * matching `created_by` on shifts.
 */
export const ImportAttendanceSchema = z.object({
    branch_id: z.coerce.number().int().positive(),
    imported_by: z.coerce.number().int().positive(),
});

export type ImportAttendanceInput = z.infer<typeof ImportAttendanceSchema>;

export interface ImportAttendanceResult {
    batch_id: number;
    file_name: string;
    /** punches read out of the file, before anything was matched or written */
    punches_read: number;
    records_created: number;
    /**
     * Already recorded, refused by the (user_id, clock_in) constraint — whether because the row
     * was previously imported, or repeated within this same file.
     */
    records_skipped: number;
    errors: ImportRowError[];
}
