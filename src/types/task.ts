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
