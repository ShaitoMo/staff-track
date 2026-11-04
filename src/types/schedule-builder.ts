import { z } from 'zod'
import { DateOnlySchema } from '@/types/date-only'

/** The solver allows up to one shift a day, so a week can't hold more than seven. */
export const MAX_SHIFTS_PER_WEEK = 7
export const DEFAULT_MAX_SHIFTS_PER_WEEK = 6

// ---------- POST /api/schedule-builder/propose ----------

/** Asks the solver to fill one branch's open coverage for the week from `weekStart`. Saves nothing. */
export const ProposeScheduleSchema = z.object({
    branchId: z.number().int().positive(),
    weekStart: DateOnlySchema,
    maxShiftsPerWeek: z.number().int().min(1).max(MAX_SHIFTS_PER_WEEK).default(DEFAULT_MAX_SHIFTS_PER_WEEK),
})

export type ProposeScheduleInput = z.infer<typeof ProposeScheduleSchema>

/** One shift the solver suggests. `roleId` is the slot it fills, so approve can check a swap kept the role. */
export interface ProposedShift {
    userId: number
    roleId: number
    periodId: number
    shiftDate: string
}

/** A (day, period, role) the solver couldn't fully staff. */
export interface UnfilledSlot {
    shiftDate: string
    periodId: number
    roleId: number
    missing: number
}

/** A day and period, e.g. Monday's Evening. */
export interface ShiftCell {
    shiftDate: string
    periodId: number
}

/** One person's scheduling rules at the branch, resolved for one week. */
export interface ScheduleRestriction {
    /** null = any period */
    allowedPeriodIds: number[] | null
    /** keep-apart partners */
    keepApartWith: number[]
    /** where a partner already works at this branch this week, so this person can't */
    partnerShifts: ShiftCell[]
}

/**
 * Someone the proposal could use, with what the swap picker needs to stay within the solver's
 * rules: the days they're already booked anywhere, how many shifts they hold this week, and their
 * scheduling rules.
 */
export interface ProposalEmployee extends ScheduleRestriction {
    userId: number
    name: string
    roleId: number
    busyDates: string[]
    existingShifts: number
}

/** Lives only in the browser until the manager approves it; nothing here is stored. */
export interface ScheduleProposal {
    maxShiftsPerWeek: number
    assignments: ProposedShift[]
    unfilled: UnfilledSlot[]
    employees: ProposalEmployee[]
}

// ---------- POST /api/schedule-builder/approve ----------

/**
 * The proposal as the manager left it, after removals and swaps, with the weekly cap it was made
 * under. Rows that no longer hold (the person left the branch or changed role, the period was
 * turned off, the day is now booked) or that would break a scheduling rule or the cap are
 * skipped and counted, not refused — the response is `{ created, skipped }` like copy-week.
 */
export const ApproveScheduleSchema = z.object({
    branchId: z.number().int().positive(),
    weekStart: DateOnlySchema,
    maxShiftsPerWeek: z.number().int().min(1).max(MAX_SHIFTS_PER_WEEK).default(DEFAULT_MAX_SHIFTS_PER_WEEK),
    shifts: z.array(z.object({
        userId: z.number().int().positive(),
        roleId: z.number().int().positive(),
        periodId: z.number().int().positive(),
        shiftDate: DateOnlySchema,
    })).min(1).max(500),
})

export type ApproveScheduleInput = z.infer<typeof ApproveScheduleSchema>

// ---------- GET / PUT /api/schedule-rules ----------

const IdSchema = z.number().int().positive()

export const ScheduleRulesQuerySchema = z.object({
    branchId: z.coerce.number().int().positive(),
})

/**
 * A branch's whole rule set. PUT replaces it: a pair or limit left out is removed. A person with
 * no `periodIds` (or no entry) can work any period.
 */
export const ScheduleRulesSchema = z.object({
    keepApart: z.array(
        z.tuple([IdSchema, IdSchema]).refine(([a, b]) => a !== b, 'A pair needs two different people.'),
    ).max(200),
    periodLimits: z.array(z.object({
        userId: IdSchema,
        periodIds: z.array(IdSchema).max(50),
    })).max(500),
})

export const SaveScheduleRulesSchema = ScheduleRulesSchema.extend({ branchId: IdSchema })

export type ScheduleRules = z.infer<typeof ScheduleRulesSchema>
export type SaveScheduleRulesInput = z.infer<typeof SaveScheduleRulesSchema>

// ---------- The Python solver (scheduler/), server to server ----------

/** Both rule fields are always sent, so a solver that predates them refuses the call instead of ignoring them. */
export interface SolverRequest {
    maxShiftsPerWeek: number
    slots: { slotId: number; date: string; periodId: number; roleId: number; needed: number }[]
    employees: {
        userId: number
        roleId: number
        existingShifts: number
        blockedSlotIds: number[]
    }[]
    keepApart: [number, number][]
}

/** Parsed, not trusted: it crosses a network boundary. */
export const SolverResponseSchema = z.object({
    assignments: z.array(z.object({ slotId: z.number().int(), userId: z.number().int() })),
    unfilled: z.array(z.object({ slotId: z.number().int(), missing: z.number().int().positive() })),
})

export type SolverResponse = z.infer<typeof SolverResponseSchema>
