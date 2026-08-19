import { z } from 'zod'
import { ShiftPeriodView } from '@/types/shift-period'

// ---------- Query filters (GET /coverage-requirements) ----------

export const CoverageRequirementFiltersSchema = z.object({
    branchId: z.coerce.number().int().positive(),
})

export type CoverageRequirementFiltersInput = z.infer<typeof CoverageRequirementFiltersSchema>

// ---------- Creation (POST /coverage-requirements) ----------

/**
 * `requiredCount` is optional on creation, matching the column's own `@default(1)`. When given it
 * must be >= 0 — 0 is a real value ("explicitly not needed"), not a missing one.
 *
 * `roleId` and `periodId` existing, and the period belonging to this branch or being global, are
 * checked by the service (CoverageRequirementService.createRequirement) — only it can read those
 * tables. The (branchId, roleId, periodId) uniqueness is left to the database's own constraint;
 * a duplicate is refused with a 409, never silently upserted.
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
