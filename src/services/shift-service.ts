import { ShiftRepository, ShiftFilters, OverlapQuery } from '@/repository/shift-repository'
import { ShiftPeriodRepository } from '@/repository/shift-period-repository'
import { UserRepository } from '@/repository/user-repository'
import { BranchRepository } from '@/repository/branch-repository'
import { RegisterRepository } from '@/repository/register-repository'
import { UserBranchRepository } from '@/repository/user-branch-repository'
import {
    BranchScheduleQueryInput,
    BranchScheduleView,
    CopyWeekInput,
    CopyWeekResult,
    CreateShiftInput,
    ShiftFiltersInput,
    ShiftView,
    UpdateShiftInput,
    UserShiftFiltersInput,
} from '@/types/shift'
import { DateOnlySchema, toDateOnlyString } from '@/types/date-only'
import { TimeOnlySchema } from '@/types/time-only'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { ShiftNotFoundError } from '@/exceptions/shift-not-found-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { RegisterNotAtBranchError } from '@/exceptions/register-not-at-branch-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { ShiftOverlapError } from '@/exceptions/shift-overlap-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_PER_WEEK = 7

/** One booked span in a copy batch: 'YYYY-MM-DD' and 'HH:MM' strings, which compare correctly as text. */
interface BookedSpan {
    userId: number
    shiftDate: string
    startTime: string
    endTime: string
}

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

    /** The week from `week_start` at one branch, names resolved, for anyone who works there. */
    static async getBranchSchedule(branchId: number, query: BranchScheduleQueryInput): Promise<BranchScheduleView> {
        const branch = await BranchRepository.getBranchById(branchId)

        if (!branch) {
            throw new BranchNotFoundError()
        }

        const [periods, shifts] = await Promise.all([
            ShiftPeriodRepository.getPeriodsByBranch(branchId),
            ShiftRepository.getBranchScheduleShifts(
                branchId,
                query.week_start,
                ShiftService.shiftDays(query.week_start, DAYS_PER_WEEK - 1),
            ),
        ])

        return {
            branch_id: branch.branchId,
            branch_name: branch.name,
            periods: periods.map((period) => ({ period_id: period.periodId, name: period.name })),
            shifts,
        }
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
        await BranchRepository.assertExists(data.branch_id)
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
            await BranchRepository.assertExists(branchId)
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
     * Copies a branch's previous week onto the week starting at `week_start`, each shift seven days
     * forward. A shift is skipped, not refused, when its person is no longer active at the branch or
     * would clash with something already booked (at any branch) — so a second run copies nothing.
     * Three reads and one insert, whatever the week's size.
     */
    static async copyWeek(data: CopyWeekInput & { created_by: number }): Promise<CopyWeekResult> {
        await BranchRepository.assertExists(data.branch_id)

        const targetFrom = data.week_start
        const targetTo = ShiftService.shiftDays(targetFrom, DAYS_PER_WEEK - 1)

        const [source, staff] = await Promise.all([
            ShiftRepository.getShifts({
                branchId: data.branch_id,
                from: ShiftService.shiftDays(targetFrom, -DAYS_PER_WEEK),
                to: ShiftService.shiftDays(targetFrom, -1),
            }),
            UserRepository.getAllUsers([data.branch_id]),
        ])

        const activeStaff = new Set(staff.filter((user) => user.isActive).map((user) => user.userId))
        const candidates = source.filter((shift) => activeStaff.has(shift.user_id))
        const userIds = [...new Set(candidates.map((shift) => shift.user_id))]

        const booked: BookedSpan[] = userIds.length === 0
            ? []
            : (await ShiftRepository.getShiftsForUsers(userIds, targetFrom, targetTo)).map((shift) => ({
                userId: shift.user_id,
                shiftDate: shift.shift_date,
                startTime: shift.start_time,
                endTime: shift.end_time,
            }))

        const rows = []

        for (const shift of candidates) {
            const shiftDate = ShiftService.shiftDays(DateOnlySchema.parse(shift.shift_date), DAYS_PER_WEEK)
            const span: BookedSpan = {
                userId: shift.user_id,
                shiftDate: toDateOnlyString(shiftDate),
                startTime: shift.start_time,
                endTime: shift.end_time,
            }

            if (booked.some((other) => ShiftService.spansClash(other, span))) {
                continue
            }

            booked.push(span)
            rows.push({
                userId: shift.user_id,
                branchId: shift.branch_id,
                registerId: shift.register_id,
                periodId: shift.period_id,
                shiftDate,
                startTime: TimeOnlySchema.parse(shift.start_time),
                endTime: TimeOnlySchema.parse(shift.end_time),
                createdBy: data.created_by,
            })
        }

        const created = await ShiftRepository.createShifts(rows)

        return { created, skipped: source.length - created }
    }

    /** Same person, same day, overlapping half-open spans — the rule ShiftRepository.buildOverlapWhere applies in SQL. */
    private static spansClash(a: BookedSpan, b: BookedSpan): boolean {
        return a.userId === b.userId
            && a.shiftDate === b.shiftDate
            && a.startTime < b.endTime
            && a.endTime > b.startTime
    }

    private static shiftDays(date: Date, days: number): Date {
        return new Date(date.getTime() + days * MS_PER_DAY)
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

        const period = await ShiftPeriodRepository.assertAtBranch(data.period_id, data.branch_id)

        return { startTime: period.defaultStart, endTime: period.defaultEnd }
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
