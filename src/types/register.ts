import { z } from 'zod'

export const RegisterValidateSchema = z.object({
    registerId: z.number().int().positive(),
    branchId: z.number().int().positive(),
    name: z.string().trim().min(1).max(50),
})

export type Register = z.infer<typeof RegisterValidateSchema>

export const CreateRegisterSchema = RegisterValidateSchema.omit({ registerId: true })

export type CreateRegisterInput = z.infer<typeof CreateRegisterSchema>

export const UpdateRegisterSchema = RegisterValidateSchema.pick({ name: true })

export type UpdateRegisterInput = z.infer<typeof UpdateRegisterSchema>
