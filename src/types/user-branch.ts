import { z } from 'zod'

export const UserBranchValidateSchema = z.object({
    userId: z.number().int().positive(),
    branchId: z.number().int().positive(),
    machineEmployeeId: z.string().min(1).max(50).optional(),
})

export type UserBranch = z.infer<typeof UserBranchValidateSchema>
