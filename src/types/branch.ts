import { z } from 'zod'

export const BranchValidateSchema = z.object({
    branchId: z.number().int().positive(),
    name: z.string().min(3).max(50),
    location: z.string().min(3).max(100).optional(),
})

export type Branch = z.infer<typeof BranchValidateSchema>

export const CreateBranchSchema = BranchValidateSchema.omit({ branchId: true })

export type CreateBranchInput = z.infer<typeof CreateBranchSchema>

export const BranchUpdateSchema = z.object({
    name: z.string().min(3).max(50).optional(),
    location: z.string().min(3).max(100).optional(),
}).refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'At least one field must be provided',
})

export type BranchUpdateInput = z.infer<typeof BranchUpdateSchema>
