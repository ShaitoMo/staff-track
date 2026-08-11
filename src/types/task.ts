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
