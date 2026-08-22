import { z } from 'zod'
import { TimeOnlySchema } from '@/types/time-only'

// ---------- Query filters (GET /periods) ----------

export const PeriodFiltersSchema = z.object({
    branchId: z.coerce.number().int().positive(),
})

export type PeriodFiltersInput = z.infer<typeof PeriodFiltersSchema>

// ---------- Creation (POST /periods) ----------

/**
 * `branchId` is optional and nullable — omitted or `null` both mean a chain-wide period, matching
 * the schema comment on ShiftPeriod. `defaultEnd` must be strictly after `defaultStart`, mirroring
 * CreateShiftSchema's own span check.
 */
export const CreatePeriodSchema = z.object({
    branchId: z.number().int().positive().nullable().optional(),
    name: z.string().min(1).max(50),
    defaultStart: TimeOnlySchema,
    defaultEnd: TimeOnlySchema,
    sortOrder: z.number().int().optional(),
}).superRefine((data, ctx) => {
    const { defaultStart, defaultEnd } = data

    if (!(defaultStart instanceof Date) || !(defaultEnd instanceof Date)) {
        return
    }

    if (defaultEnd <= defaultStart) {
        ctx.addIssue({
            code: 'custom',
            path: ['defaultEnd'],
            message: 'defaultEnd must be after defaultStart',
        })
    }
})

export type CreatePeriodInput = z.infer<typeof CreatePeriodSchema>

// ---------- Editing (PATCH /periods/:id) ----------

/**
 * `branchId` is not editable — moving a period between branches (or to/from global) changes what
 * it can attach to, which is a new period, not an edit. `defaultStart`/`defaultEnd` must be sent
 * together, same reason as UpdateShiftSchema's start/end pairing.
 */
export const UpdatePeriodSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    defaultStart: TimeOnlySchema.optional(),
    defaultEnd: TimeOnlySchema.optional(),
    sortOrder: z.number().int().optional(),
}).refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'At least one field must be provided',
}).superRefine((data, ctx) => {
    const { defaultStart, defaultEnd } = data

    if (defaultStart === undefined && defaultEnd === undefined) {
        return
    }

    if (defaultStart === undefined || defaultEnd === undefined) {
        ctx.addIssue({
            code: 'custom',
            path: [defaultStart === undefined ? 'defaultStart' : 'defaultEnd'],
            message: 'Send defaultStart and defaultEnd together: neither describes the resulting span on its own',
        })
        return
    }

    if (!(defaultStart instanceof Date) || !(defaultEnd instanceof Date)) {
        return
    }

    if (defaultEnd <= defaultStart) {
        ctx.addIssue({
            code: 'custom',
            path: ['defaultEnd'],
            message: 'defaultEnd must be after defaultStart',
        })
    }
})

export type UpdatePeriodInput = z.infer<typeof UpdatePeriodSchema>

// ---------- Response shape ----------

export interface ShiftPeriodView {
    periodId: number
    branchId: number | null
    name: string
    defaultStart: string
    defaultEnd: string
    sortOrder: number
}
