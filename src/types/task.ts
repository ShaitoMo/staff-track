import {z} from "zod";

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
