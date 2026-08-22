import { ShiftRepository, ShiftFilters, OverlapQuery } from '@/repository/shift-repository'
import { ShiftPeriodRepository, ShiftPeriodRecord } from '@/repository/shift-period-repository'
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
import { ShiftPeriodNotFoundError } from '@/exceptions/shift-period-not-found-error'
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error'

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
     * Schedules a shift. Checks run before the insert since the DB either can't make them at all
     * (the overlap) or makes them in a shape no client can act on (a raw FK violation). Branch is
     * settled first — everything after it is relative to it.
     */
    static async createShift(data: CreateShiftInput): Promise<ShiftView> {
        await ShiftService.assertBranchExists(data.branch_id)
        await ShiftService.assertUserWorksAtBranch(data.user_id, data.branch_id)
        await ShiftService.assertRegisterAtBranch(data.register_id, data.branch_id)

        const span = await ShiftService.resolveSpan(data)

        await ShiftService.assertNoDoubleBooking({
            userId: data.user_id,
            shiftDate: data.shift_date,
            startTime: span.startTime,
            endTime: span.endTime,
        })

        return ShiftRepository.createShift(data, span)
    }

    /**
     * Edits a shift, re-running the create-path checks against the row as it will stand, not the
     * request. Each check is skipped when nothing it depends on changed, except the register: it's
     * re-checked when the branch moves, since a register the request didn't mention would
     * otherwise be silently dropped — refused instead (422), client sends `register_id` explicitly.
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
     * The span to test for clashes: whichever of date/times the request moved, over stored values
     * for the rest. Parses ShiftView's string fields back through the same schemas that anchored
     * them, so the epoch-day/UTC-midnight conventions stay in one place — re-deriving them here is
     * how a comparison ends up a day out.
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

    /**
     * The span to store: the period's defaults when `period_id` is given, copied onto the row (not
     * read live) so editing a period later can't retroactively change what a past shift meant.
     * Otherwise the caller's own times. CreateShiftSchema guarantees exactly one source is present.
     */
    private static async resolveSpan(data: CreateShiftInput): Promise<{ startTime: Date; endTime: Date }> {
        if (data.period_id === undefined) {
            return { startTime: data.start_time as Date, endTime: data.end_time as Date }
        }

        const period = await ShiftService.assertPeriodAtBranch(data.period_id, data.branch_id)

        return { startTime: period.defaultStart, endTime: period.defaultEnd }
    }

    /**
     * A period that exists but is scoped to another branch cannot supply this shift's hours — a
     * NULL branch_id on the period is the chain-wide default and matches every branch, matching
     * ShiftPeriod's own schema comment.
     */
    private static async assertPeriodAtBranch(periodId: number, branchId: number): Promise<ShiftPeriodRecord> {
        const period = await ShiftPeriodRepository.getPeriodById(periodId)

        if (!period) {
            throw new ShiftPeriodNotFoundError()
        }

        if (period.branchId !== null && period.branchId !== branchId) {
            throw new ShiftPeriodNotAtBranchError()
        }

        return period
    }

    private static async assertBranchExists(branchId: number): Promise<void> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }
    }

    /**
     * Scheduling someone where they don't work (mirrors TaskService.createTask's assignee rule) —
     * `user_branches` is the one place that says where work can be given. Doubles as the existence
     * check on `user_id`: a missing user and a missing link are the same answer here.
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
     * Refuses a second shift over the same hours for the same person — branch isn't part of the
     * question, since a worker can't be at two branches at once. Read-then-write in two statements,
     * so two racing requests can both insert; closing that needs a Postgres exclusion constraint on
     * (user_id, shift_date, timespan), which the schema doesn't have yet.
     */
    private static async assertNoDoubleBooking(query: OverlapQuery): Promise<void> {
        const overlapping = await ShiftRepository.getOverlappingShifts(query)

        if (overlapping.length > 0) {
            throw new ShiftOverlapError()
        }
    }
}
