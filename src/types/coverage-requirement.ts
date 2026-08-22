import { z } from 'zod'
import { ShiftPeriodView } from '@/types/shift-period'

// ---------- Query filters (GET /coverage-requirements) ----------

export const CoverageRequirementFiltersSchema = z.object({
    branchId: z.coerce.number().int().positive(),
})

export type CoverageRequirementFiltersInput = z.infer<typeof CoverageRequirementFiltersSchema>

// ---------- Creation (POST /coverage-requirements) ----------

/**
 * `requiredCount` is optional (matches the column's `@default(1)`); 0 is a real value ("not
 * needed"), not a missing one. `roleId`/`periodId` existence and branch/global scoping are
 * service-checked; (branchId, roleId, periodId) uniqueness is left to the DB constraint — a
 * duplicate is refused with 409, never silently upserted.
 */
export const CreateCoverageRequirementSchema = z.object({
    branchId: z.number().int().positive(),
    roleId: z.number().int().positive(),
    periodId: z.number().int().positive(),
    requiredCount: z.number().int().min(0).optional(),
})

export type CreateCoverageRequirementInput = z.infer<typeof CreateCoverageRequirementSchema>

// ---------- Editing (PATCH /coverage-requirements/:id) ----------

/** requiredCount is the only field a requirement's identity doesn't pin down, so it's the only edit. */
export const UpdateCoverageRequirementSchema = z.object({
    requiredCount: z.number().int().min(0),
})

export type UpdateCoverageRequirementInput = z.infer<typeof UpdateCoverageRequirementSchema>

// ---------- Response shape ----------

/** Role and period expanded, not just their ids — this is what the roles × periods grid renders from. */
export interface CoverageRequirementView {
    requirementId: number
    branchId: number
    requiredCount: number
    role: {
        roleId: number
        name: string
    }
    period: ShiftPeriodView
}
