import { z } from 'zod'
import { DateOnlySchema } from '@/types/date-only'

// ---------- Query filters (GET /branches/:id/coverage) ----------

/** `branchId` comes from the path, not the query — see /branches/:id/registers for the same split. */
export const CoverageGapsFiltersSchema = z.object({
    weekStart: DateOnlySchema,
})

export type CoverageGapsFiltersInput = z.infer<typeof CoverageGapsFiltersSchema>

// ---------- Response shape ----------

/**
 * requiredCount vs scheduledCount for one (shiftDate, role, period) in a branch's week.
 *
 * Every requirement applies to every date now that CoverageRequirement has no weekday — this is a
 * plain cross-join of the branch's requirements against the seven dates, not a resolved override.
 * A `requiredCount` of 0 is meaningful ("explicitly not needed"), not an absent row.
 */
export interface CoverageGapRow {
    shiftDate: string
    roleId: number
    periodId: number
    requiredCount: number
    scheduledCount: number
}
