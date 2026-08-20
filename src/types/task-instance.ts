import { z } from 'zod';
import { DateOnlySchema } from '@/types/date-only';

/** Mirrors the task_status enum; spelled out so this layer stays free of Prisma. */
export const TASK_STATUSES = ['pending', 'completed', 'verified', 'rejected'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

// ---------- Query filters (GET /api/task-instances) ----------

/** Coerces string query parameters to numbers; all filters optional. */
export const TaskInstanceFiltersSchema = z.object({
    user_id: z.coerce.number().int().positive().optional(),
    branch_id: z.coerce.number().int().positive().optional(),
    date: DateOnlySchema.optional(),
    status: z.enum(TASK_STATUSES).optional(),
});

export type TaskInstanceFiltersInput = z.infer<typeof TaskInstanceFiltersSchema>;

/**
 * GET /api/users/:userId/tasks — the user comes from the path, so only the date window and
 * status survive from TaskInstanceFiltersSchema; due_from/due_to bound due_date inclusively,
 * mirroring UserShiftFiltersSchema's from/to.
 */
export const UserTaskInstanceFiltersSchema = z.object({
    due_from: DateOnlySchema.optional(),
    due_to: DateOnlySchema.optional(),
    status: z.enum(TASK_STATUSES).optional(),
});

export type UserTaskInstanceFiltersInput = z.infer<typeof UserTaskInstanceFiltersSchema>;

// ---------- Write payloads ----------

/**
 * PATCH /api/task-instances/:id/complete
 *
 * No body fields beyond the multipart `photo` — the acting user is the session (getCurrentUser),
 * not a request field. Note that no timestamp is accepted either: completed_at is taken from the
 * server clock.
 */

/** PATCH /api/task-instances/:id/review — the acting user is the session, not a request field. */
export const ReviewTaskInstanceSchema = z.object({
    decision: z.enum(['verified', 'rejected']),
});

export type ReviewTaskInstanceInput = z.infer<typeof ReviewTaskInstanceSchema>;

// ---------- Response shapes ----------

export interface MediaView {
    media_id: number;
    file_path: string;
    uploaded_by: number;
    server_timestamp: Date;
}

interface TaskInstanceBase {
    instance_id: number;
    task_id: number;
    due_date: string;
    status: TaskStatus;
    completed_by: number | null;
    completed_at: Date | null;
    reviewed_by: number | null;
    reviewed_at: Date | null;
    task: {
        task_id: number;
        title: string;
        description: string | null;
        branch_id: number;
        branch_name: string;
        assigned_to: number | null;
        assigned_role_id: number | null;
    };
    /** Named person the task targets; null when it targets a whole role. */
    assignee: { user_id: number; name: string } | null;
}

/** List row: only the newest photo, to keep the daily list light. */
export interface TaskInstanceListView extends TaskInstanceBase {
    latest_photo: MediaView | null;
}

/** Detail row: every photo, newest first. */
export interface TaskInstanceDetailView extends TaskInstanceBase {
    media: MediaView[];
}
