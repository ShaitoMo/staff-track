import { AttendanceRepository } from '@/repository/attendance-repository'
import { BranchRepository } from '@/repository/branch-repository'
import { ShiftRepository } from '@/repository/shift-repository'
import { UserRepository } from '@/repository/user-repository'
import { ScheduleVsActualFiltersInput, ScheduleVsActualRow } from '@/types/schedule-vs-actual'
import { compareScheduleWithAttendance } from '@/lib/schedule-vs-actual'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export class ScheduleVsActualService {

    /**
     * Every scheduled shift in the window with what attendance says actually happened (FR6).
     *
     * A filter naming a branch or a user is checked before the read, so asking about something that
     * does not exist is an error rather than an empty report — an empty report and 'nobody by that
     * id' look identical to a manager otherwise.
     */
    static async getScheduleVsActual(
        filters: ScheduleVsActualFiltersInput,
    ): Promise<ScheduleVsActualRow[]> {
        const { branch_id: branchId, user_id: userId, from, to } = filters

        if (branchId !== undefined) {
            await ScheduleVsActualService.assertBranchExists(branchId)
        }

        if (userId !== undefined) {
            await ScheduleVsActualService.assertUserExists(userId)
        }

        const shifts = await ShiftRepository.getShifts({ branchId, userId, from, to })

        const punches = await AttendanceRepository.getAttendance({
            branchId,
            userId,
            // Wider than the report's own window on both ends: shifts are filtered by calendar
            // date, punches by instant, and the two only line up through the machine's timezone.
            // A shift late on the last day ends after that day does, and one early on the first day
            // can be clocked into before it starts.
            from: new Date(from.getTime() - MS_PER_DAY),
            to: new Date(to.getTime() + 2 * MS_PER_DAY),
        })

        return compareScheduleWithAttendance(shifts, punches)
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }
    }

    private static async assertUserExists(userId: number): Promise<void> {
        const user = await UserRepository.getUserById(userId)

        if (!user) {
            throw new UserNotFoundError()
        }
    }
}
