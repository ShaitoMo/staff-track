import { db } from '@/lib/db'

export interface ScheduledShiftRoleRow {
    shiftDate: Date
    periodId: number
    roleId: number
    userId: number
}

export class CoverageRepository {
    /**
     * Every shift scheduled from a period at this branch across the whole week, in one query —
     * shifts carries no role column, so the role comes through the worker instead.
     *
     * That join is to the worker's *current* roleId, not the role they held on `shiftDate` — there
     * is no history of past role changes to join against instead. A role change today silently
     * rewrites how every past week's coverage numbers read, since the same shift rows get re-joined
     * to the new role on the next request. `userId` is carried through so the read side can still
     * count distinct workers rather than distinct shift rows.
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
                userId: true,
                user: { select: { roleId: true } },
            },
        })

        return shifts.map((shift) => ({
            shiftDate: shift.shiftDate,
            // narrowed by the periodId: { not: null } filter above
            periodId: shift.periodId as number,
            roleId: shift.user.roleId,
            userId: shift.userId,
        }))
    }
}
