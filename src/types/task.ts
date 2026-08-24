import {z} from "zod";
import { DateOnlySchema } from "@/types/date-only";
import { isValidRecurrence } from "@/lib/recurrence";

export const TaskSchema = z.object({
    task_id: z.number(),
    title: z.string(),
    description: z.string().nullable(),
    branch_id: z.number(),
    assigned_to: z.number().nullable(),
    assigned_role_id: z.number().nullable(),
    assigned_by: z.number(),
    origin: z.string(),
    is_recurring: z.boolean(),
    recurrence: z.string().nullable(),
    active: z.boolean(),
    created_at: z.date(),
});
export type Task = z.infer<typeof TaskSchema>;

/**
 * PATCH /api/tasks/:taskId
 *
 * Holds the same invariant as CreateTaskSchema — `is_recurring` is true exactly when there is a
 * parseable rule — but has to hold it against a partial body, where an absent field means 'leave
 * it alone' rather than 'null'.
 *
 * Hence the pairing rule: `is_recurring` and `recurrence` must be sent together or not at all.
 * Sent alone, neither can be judged. `{ is_recurring: true }` is valid only if the stored rule is
 * non-null, and `{ recurrence: null }` only if the task is not recurring — the body simply does
 * not say. So editing a recurring task's rule means sending `is_recurring: true` alongside it,
 * restating the kind rather than changing it — `updateTask` refuses any actual change, since a
 * task is one-off or recurring from creation. Requiring the pair keeps the schedule fully
 * described by the request, which
 * is what lets it be rejected here with a 400 rather than discovered later by a job that quietly
 * generates nothing.
 */
export const UpdateTaskSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    assigned_to: z.number().int().positive().nullable().optional(),
    assigned_role_id: z.number().int().positive().nullable().optional(),
    is_recurring: z.boolean().optional(),
    recurrence: z.string().min(1).nullable().optional(),
    active: z.boolean().optional(),
}).refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'At least one field must be provided',
}).superRefine((data, ctx) => {
    const { is_recurring: isRecurring, recurrence } = data;

    if (isRecurring === undefined && recurrence === undefined) {
        return;
    }

    if (isRecurring === undefined || recurrence === undefined) {
        ctx.addIssue({
            code: 'custom',
            path: [isRecurring === undefined ? 'is_recurring' : 'recurrence'],
            message: 'Send is_recurring and recurrence together: neither describes the resulting schedule on its own',
        });
        return;
    }

    if (isRecurring) {
        if (recurrence === null) {
            ctx.addIssue({
                code: 'custom',
                path: ['recurrence'],
                message: 'A recurring task requires a recurrence rule',
            });
        } else if (!isValidRecurrence(recurrence)) {
            ctx.addIssue({
                code: 'custom',
                path: ['recurrence'],
                message: "Recurrence must be 'daily' or 'weekly:<days>' (e.g. 'weekly:mon,wed')",
            });
        }

        return;
    }

    if (recurrence !== null) {
        ctx.addIssue({
            code: 'custom',
            path: ['recurrence'],
            message: 'A one-off task must have a null recurrence',
        });
    }
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

/**
 * POST /api/tasks
 *
 * Two independent either/or rules are enforced here, both mirroring constraints the database
 * also holds, so a bad body is refused with a 400 naming the field rather than a 500 from Postgres:
 *
 *   1. person XOR role  - exactly one of assigned_to / assigned_role_id (tasks_person_xor_role)
 *   2. one-off XOR recurring - due_date alone, or a parseable recurrence alone
 */
export const CreateTaskSchema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().nullable().optional(),
    branch_id: z.number().int().positive(),
    assigned_to: z.number().int().positive().nullable().optional(),
    assigned_role_id: z.number().int().positive().nullable().optional(),
    // the acting user; a request field only until authentication exists
    assigned_by: z.number().int().positive(),
    origin: z.enum(['assigned', 'self']).default('assigned'),
    is_recurring: z.boolean().default(false),
    due_date: DateOnlySchema.nullable().optional(),
    recurrence: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
    const hasAssignee = data.assigned_to !== null && data.assigned_to !== undefined;
    const hasRole = data.assigned_role_id !== null && data.assigned_role_id !== undefined;

    if (hasAssignee === hasRole) {
        ctx.addIssue({
            code: 'custom',
            path: ['assigned_to'],
            message: 'Provide exactly one of assigned_to or assigned_role_id',
        });
    }

    const hasDueDate = data.due_date !== null && data.due_date !== undefined;
    const hasRecurrence = data.recurrence !== null && data.recurrence !== undefined;

    if (data.is_recurring) {
        if (!hasRecurrence) {
            ctx.addIssue({
                code: 'custom',
                path: ['recurrence'],
                message: 'A recurring task requires a recurrence rule',
            });
        } else if (!isValidRecurrence(data.recurrence as string)) {
            ctx.addIssue({
                code: 'custom',
                path: ['recurrence'],
                message: "Recurrence must be 'daily' or 'weekly:<days>' (e.g. 'weekly:mon,wed')",
            });
        }

        if (hasDueDate) {
            ctx.addIssue({
                code: 'custom',
                path: ['due_date'],
                message: 'A recurring task must not carry a due_date; its dates come from the recurrence',
            });
        }

        return;
    }

    if (!hasDueDate) {
        ctx.addIssue({
            code: 'custom',
            path: ['due_date'],
            message: 'A one-off task requires a due_date',
        });
    }

    if (hasRecurrence) {
        ctx.addIssue({
            code: 'custom',
            path: ['recurrence'],
            message: 'A one-off task must have a null recurrence',
        });
    }
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
