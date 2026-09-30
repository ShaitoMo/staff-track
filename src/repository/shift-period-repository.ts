import { Prisma, ShiftPeriod as ShiftPeriodRow } from '@prisma/client'
import { db } from '@/lib/db'
import { CreatePeriodInput, ShiftPeriodView, UpdatePeriodInput } from '@/types/shift-period'
import { toTimeOnlyString } from '@/types/time-only'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error'
import { PeriodInUseError } from '@/exceptions/period-in-use-error'

/** A period whose own `defaultStart`/`defaultEnd` are still Dates — for callers (ShiftService) that
 *  need to copy them onto a shift row rather than the formatted 'HH:MM' strings ShiftPeriodView carries. */
export interface ShiftPeriodRecord {
    periodId: number
    branchId: number | null
    defaultStart: Date
    defaultEnd: Date
}

export class ShiftPeriodRepository {
    /** Periods available to a branch: its own, plus every chain-wide one. */
    static async getPeriodsByBranch(branchId: number): Promise<ShiftPeriodView[]> {
        const periods = await db.shiftPeriod.findMany({
            where: { OR: [{ branchId }, { branchId: null }] },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })

        return periods.map(ShiftPeriodRepository.toView)
    }

    static async getPeriodById(periodId: number): Promise<ShiftPeriodRecord | null> {
        return db.shiftPeriod.findUnique({
            where: { periodId },
            select: { periodId: true, branchId: true, defaultStart: true, defaultEnd: true },
        })
    }

    /**
     * A period that exists but is scoped to another branch cannot supply hours for a shift or
     * requirement at this one — a NULL branchId on the period is the chain-wide default and
     * matches every branch.
     */
    static async assertAtBranch(periodId: number, branchId: number): Promise<ShiftPeriodRecord> {
        const period = await ShiftPeriodRepository.getPeriodById(periodId)

        if (!period) {
            throw new ShiftPeriodNotFoundError()
        }

        if (period.branchId !== null && period.branchId !== branchId) {
            throw new ShiftPeriodNotAtBranchError()
        }

        return period
    }

    static async createPeriod(data: CreatePeriodInput): Promise<ShiftPeriodView> {
        try {
            const period = await db.shiftPeriod.create({
                data: {
                    branchId: data.branchId ?? null,
                    name: data.name,
                    defaultStart: data.defaultStart,
                    defaultEnd: data.defaultEnd,
                    sortOrder: data.sortOrder ?? 0,
                },
            })

            return ShiftPeriodRepository.toView(period)
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                throw new BranchNotFoundError()
            }
            throw error
        }
    }

    static async updatePeriod(periodId: number, data: UpdatePeriodInput): Promise<ShiftPeriodView> {
        try {
            const period = await db.shiftPeriod.update({
                where: { periodId },
                data: {
                    name: data.name,
                    defaultStart: data.defaultStart,
                    defaultEnd: data.defaultEnd,
                    sortOrder: data.sortOrder,
                },
            })

            return ShiftPeriodRepository.toView(period)
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new ShiftPeriodNotFoundError()
            }
            throw error
        }
    }

    /** Never cascades: a period a shift or coverage requirement still references is refused (409). */
    static async deletePeriod(periodId: number): Promise<void> {
        try {
            await db.shiftPeriod.delete({ where: { periodId } })
        } catch (error: unknown) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new ShiftPeriodNotFoundError()
                }
                if (error.code === 'P2003') {
                    throw new PeriodInUseError()
                }
            }
            throw error
        }
    }

    private static toView(period: ShiftPeriodRow): ShiftPeriodView {
        return {
            periodId: period.periodId,
            branchId: period.branchId,
            name: period.name,
            defaultStart: toTimeOnlyString(period.defaultStart),
            defaultEnd: toTimeOnlyString(period.defaultEnd),
            sortOrder: period.sortOrder,
        }
    }
}
