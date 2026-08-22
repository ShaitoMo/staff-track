import { db } from '@/lib/db'

export interface ScheduledShiftRoleRow {
    shiftDate: Date
    periodId: number
    roleId: number
}

export class CoverageRepository {
    /**
     * Every shift scheduled from a period at this branch across the whole week, in one query —
     * shifts carries no role column, so the role comes through the worker instead.
     */
    static async getScheduledShiftsByBranch(
        branchId: number,
        from: Date,
        to: Date,
    ): Promise<ScheduledShiftRoleRow[]> {
        const shifts = await db.shift.findMany({
            where: {
                branchId,
                periodId: { not: null },
                shiftDate: { gte: from, lte: to },
            },
            select: {
                shiftDate: true,
                periodId: true,
                user: { select: { roleId: true } },
            },
        })

        return shifts.map((shift) => ({
            shiftDate: shift.shiftDate,
            // narrowed by the periodId: { not: null } filter above
            periodId: shift.periodId as number,
            roleId: shift.user.roleId,
        }))
    }
}
