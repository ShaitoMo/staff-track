import { z } from 'zod'
export const RoleValidateSchema = z.object({
    roleId: z.number().int().positive(),
    name: z.string().min(3).max(50),
})
export type Role = z.infer<typeof RoleValidateSchema>

export type CreateRoleInput = Omit<Role, 'roleId'>

export const CreateRoleSchema = RoleValidateSchema.omit({ roleId: true })

