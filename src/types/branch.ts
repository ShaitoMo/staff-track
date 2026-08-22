import { z } from 'zod'

export const BranchValidateSchema = z.object({
    branchId: z.number().int().positive(),
    name: z.string().min(3).max(50),
    location: z.string().min(3).max(100).optional(),
})

export type Branch = z.infer<typeof BranchValidateSchema>

export const CreateBranchSchema = BranchValidateSchema.omit({ branchId: true })

export type CreateBranchInput = z.infer<typeof CreateBranchSchema>