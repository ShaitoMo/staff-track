import { z } from 'zod';
import { TaskStatus } from '@prisma/client';
import { DateOnlySchema } from '@/types/date-only';

// ---------- Query filters (GET /api/task-instances) ----------

/**
 * Query parameters arrive as strings, so numeric ids are coerced here rather than in the route.
 * Every filter is optional; supplying none lists all instances.
 */
export const TaskInstanceFiltersSchema = z.object({
    user_id: z.coerce.number().int().positive().optional(),
    branch_id: z.coerce.number().int().positive().optional(),
    date: DateOnlySchema.optional(),
    status: z.enum(TaskStatus).optional(),
});

export type TaskInstanceFiltersInput = z.infer<typeof TaskInstanceFiltersSchema>;

// ---------- Write payloads ----------

/**
 * PATCH /api/task-instances/:id/complete
 *
 * `completed_by` is the acting user. It is a request field only because authentication does
 * not exist yet — once it does, this comes from the session and leaves the payload.
 * Note that no timestamp is accepted: completed_at is taken from the server clock.
 */
export const CompleteTaskInstanceSchema = z.object({
    completed_by: z.coerce.number().int().positive(),
});

/** PATCH /api/task-instances/:id/review */
export const ReviewTaskInstanceSchema = z.object({
    decision: z.enum([TaskStatus.verified, TaskStatus.rejected]),
    // acting user; see the note on CompleteTaskInstanceSchema
    reviewed_by: z.coerce.number().int().positive(),
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
