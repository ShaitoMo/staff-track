import { ShiftRepository, ShiftFilters, OverlapQuery } from '@/repository/shift-repository'
import { UserRepository } from '@/repository/user-repository'
import { BranchRepository } from '@/repository/branch-repository'
import { RegisterRepository } from '@/repository/register-repository'
import { UserBranchRepository } from '@/repository/user-branch-repository'
import {
    CreateShiftInput,
    ShiftFiltersInput,
    ShiftView,
    UpdateShiftInput,
    UserShiftFiltersInput,
} from '@/types/shift'
import { DateOnlySchema } from '@/types/date-only'
import { TimeOnlySchema } from '@/types/time-only'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { ShiftNotFoundError } from '@/exceptions/shift-not-found-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { RegisterNotAtBranchError } from '@/exceptions/register-not-at-branch-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { ShiftOverlapError } from '@/exceptions/shift-overlap-error'

export class ShiftService {
    static async getShiftById(shiftId: number): Promise<ShiftView | null> {
        return ShiftRepository.getShiftById(shiftId)
    }

    static async getShifts(filters: ShiftFiltersInput): Promise<ShiftView[]> {
        const repositoryFilters: ShiftFilters = {
            branchId: filters.branch_id,
            userId: filters.user_id,
            registerId: filters.register_id,
            from: filters.from,
            to: filters.to,
        }

        return ShiftRepository.getShifts(repositoryFilters)
    }


    static async getShiftsForUser(
        userId: number,
        filters: UserShiftFiltersInput,
    ): Promise<ShiftView[]> {
        const user = await UserRepository.getUserById(userId)

        if (!user) {
            throw new UserNotFoundError()
        }

        return ShiftRepository.getShifts({ userId, from: filters.from, to: filters.to })
    }

    /**
     * Schedules a shift.
     *
     * The four checks run before the insert because the database either cannot make them at all
     * (the overlap) or makes them in a shape no client can act on (a foreign-key violation naming
     * a constraint). Order matters only in that the branch is settled first, since the two checks
     * after it are both relative to it.
     */
    static async createShift(data: CreateShiftInput): Promise<ShiftView> {
        await ShiftService.assertBranchExists(data.branch_id)
        await ShiftService.assertUserWorksAtBranch(data.user_id, data.branch_id)
        await ShiftService.assertRegisterAtBranch(data.register_id, data.branch_id)
        await ShiftService.assertNoDoubleBooking({
            userId: data.user_id,
            shiftDate: data.shift_date,
            startTime: data.start_time,
            endTime: data.end_time,
        })

        return ShiftRepository.createShift(data)
    }

    /**
     * Edits a shift, re-running the create-path checks against the row as it will stand — not
     * against the request, which only carries the fields that are moving.
     *
     * Each check is skipped when nothing it depends on changed, with one exception worth its own
     * line: the register is re-checked when the *branch* moves, because a register the request
     * never mentioned belongs to the branch being left behind. The alternative — quietly nulling
     * it — would drop a scheduling fact nobody asked to drop, so it is refused instead (422) and
     * the client sends `register_id` explicitly.
     */
    static async updateShift(shiftId: number, data: UpdateShiftInput): Promise<ShiftView> {
        const before = await ShiftRepository.getShiftById(shiftId)

        if (!before) {
            throw new ShiftNotFoundError()
        }

        const userId = data.user_id ?? before.user_id
        const branchId = data.branch_id ?? before.branch_id
        const registerId = data.register_id !== undefined ? data.register_id : before.register_id

        if (data.branch_id !== undefined) {
            await ShiftService.assertBranchExists(branchId)
        }

        // Either side of this pair can be the one that moved, and a worker who is fine at their
        // own branch may not be at another.
        if (data.user_id !== undefined || data.branch_id !== undefined) {
            await ShiftService.assertUserWorksAtBranch(userId, branchId)
        }

        if (data.branch_id !== undefined || data.register_id !== undefined) {
            await ShiftService.assertRegisterAtBranch(registerId, branchId)
        }

        // `end_time` cannot arrive without `start_time` (UpdateShiftSchema pairs them), so with
        // the worker these three are the whole question of whether the booking moved.
        if (data.user_id !== undefined || data.shift_date !== undefined || data.start_time !== undefined) {
            await ShiftService.assertNoDoubleBooking({
                userId,
                ...ShiftService.mergeSpan(before, data),
                excludeShiftId: shiftId,
            })
        }

        return ShiftRepository.updateShift(shiftId, data)
    }

    static async deleteShift(shiftId: number): Promise<void> {
        return ShiftRepository.deleteShift(shiftId)
    }

    /**
     * The span to test for clashes: whichever of the date and the two times the request moved,
     * over the stored values for the rest.
     *
     * A stored shift comes back as a ShiftView, where those three are JSON strings, and the
     * overlap query compares Dates. Parsing them back through the very schemas that anchored them
     * on the way in keeps the epoch-day and UTC-midnight conventions in one place — re-deriving
     * them here is how a comparison ends up a day out.
     */
    private static mergeSpan(
        before: ShiftView,
        data: UpdateShiftInput,
    ): { shiftDate: Date; startTime: Date; endTime: Date } {
        return {
            shiftDate: data.shift_date ?? DateOnlySchema.parse(before.shift_date),
            startTime: data.start_time ?? TimeOnlySchema.parse(before.start_time),
            endTime: data.end_time ?? TimeOnlySchema.parse(before.end_time),
        }
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }
    }

    /**
     * Scheduling someone where they do not work, mirroring the rule TaskService.createTask applies
     * to a named assignee: user_branches is the one place that says where a person can be given
     * work, and a shift is work.
     *
     * A missing link and a missing user are the same answer here — neither is a user who works at
     * this branch — so this doubles as the existence check on user_id.
     */
    private static async assertUserWorksAtBranch(userId: number, branchId: number): Promise<void> {
        const links = await UserBranchRepository.getUserBranches({ userId, branchId })

        if (links.length === 0) {
            throw new UserNotAtBranchError()
        }
    }

    /** A register is optional — NULL on any shift that is not a cashier's — but if named it has to
     * stand at the shift's own branch. */
    private static async assertRegisterAtBranch(
        registerId: number | null | undefined,
        branchId: number,
    ): Promise<void> {
        if (registerId === null || registerId === undefined) {
            return
        }

        const register = await RegisterRepository.getRegisterById(registerId)

        if (!register) {
            throw new RegisterNotFoundError()
        }

        if (register.branchId !== branchId) {
            throw new RegisterNotAtBranchError()
        }
    }

    /**
     * Refuses a second shift over the same hours for the same person. Branch is not part of the
     * question: a worker who covers two branches still cannot be at both at once, which is the
     * same reason getShiftsForUser needs no branch filter.
     *
     * This reads and then writes in two statements, so two requests racing each other can both
     * find nothing and both insert. Closing that properly needs a Postgres exclusion constraint on
     * (user_id, shift_date, timespan), which the schema does not have yet — worth adding before
     * more than one manager schedules at a time.
     */
    private static async assertNoDoubleBooking(query: OverlapQuery): Promise<void> {
        const overlapping = await ShiftRepository.getOverlappingShifts(query)

        if (overlapping.length > 0) {
            throw new ShiftOverlapError()
        }
    }
}
