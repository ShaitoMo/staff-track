import { ShiftRepository, NewShiftRow } from '@/repository/shift-repository'
import { ShiftPeriodRepository } from '@/repository/shift-period-repository'
import { UserRepository } from '@/repository/user-repository'
import { BranchRepository } from '@/repository/branch-repository'
import { ScheduleRuleRepository } from '@/repository/schedule-rule-repository'
import { CoverageGapsService } from '@/services/coverage-gaps-service'
import { solveSchedule } from '@/lib/scheduler-client'
import { addDays } from '@/lib/recurrence'
import { blockedSlotIds, blockReason, partnersOf, resolveRestrictions } from '@/lib/scheduling-rules'
import { toDateOnlyString } from '@/types/date-only'
import { TimeOnlySchema } from '@/types/time-only'
import { CopyWeekResult, ShiftView } from '@/types/shift'
import { ShiftPeriodView } from '@/types/shift-period'
import {
    ApproveScheduleInput,
    ProposalEmployee,
    ProposedShift,
    ProposeScheduleInput,
    ScheduleProposal,
    ScheduleRestriction,
    ScheduleRules,
    SolverRequest,
} from '@/types/schedule-builder'

const DAYS_PER_WEEK = 7

type SolverSlot = SolverRequest['slots'][number]
type ApprovedShift = ApproveScheduleInput['shifts'][number]

/**
 * Auto-fill for one branch's week. `propose` asks the solver in scheduler/ and saves nothing;
 * `approve` turns what the manager kept into ordinary shifts. Both apply the solver's own rules —
 * one shift per person per day counting shifts at every branch, the weekly cap, and the branch's
 * scheduling rules — so an approved week can't break what the proposal had to respect.
 */
export class ScheduleBuilderService {
    /**
     * What the week still needs (requirement minus already scheduled, per day, period and role),
     * who at the branch could fill it, and the solver's answer. Only the roles with an open slot are
     * sent — nobody else can be placed. Nobody to place (including a week with nothing open) skips
     * the solver call. The branch's scheduling rules go along as slots each person can't take and
     * pairs to keep apart; a keep-apart partner already working a day and period here blocks it too.
     */
    static async propose(data: ProposeScheduleInput): Promise<ScheduleProposal> {
        const [gaps, users, rules] = await Promise.all([
            // also the branch existence check
            CoverageGapsService.getCoverageGaps(data.branchId, data.weekStart),
            UserRepository.getAllUsers([data.branchId]),
            ScheduleRuleRepository.getRules(data.branchId),
        ])

        const slots: SolverSlot[] = gaps
            .filter((gap) => gap.requiredCount > gap.scheduledCount)
            .map((gap, slotId) => ({
                slotId,
                date: gap.shiftDate,
                periodId: gap.periodId,
                roleId: gap.roleId,
                needed: gap.requiredCount - gap.scheduledCount,
            }))
        const openRoles = new Set(slots.map((slot) => slot.roleId))
        // no open slot means no open role, so this also covers a fully staffed week
        const staff = users.filter((user) => user.isActive && openRoles.has(user.roleId))
        const employees = staff.length === 0
            ? []
            : await ScheduleBuilderService.loadEmployees(data.branchId, ScheduleBuilderService.weekOf(data.weekStart), staff, rules)
        const staffIds = employees.map((employee) => employee.userId)

        // nobody to place leaves every open slot short, without asking the solver
        const solved = employees.length === 0
            ? { assignments: [], unfilled: slots.map(({ slotId, needed }) => ({ slotId, missing: needed })) }
            : await solveSchedule({
                maxShiftsPerWeek: data.maxShiftsPerWeek,
                slots,
                employees: employees.map((employee) => ({
                    userId: employee.userId,
                    roleId: employee.roleId,
                    existingShifts: employee.existingShifts,
                    blockedSlotIds: blockedSlotIds(employee, slots),
                })),
                // pairs with someone not up for the week are already in the other person's blockedSlotIds
                keepApart: rules.keepApart.filter((pair) => pair.every((userId) => staffIds.includes(userId))),
            })
        const slotById = new Map(slots.map((slot) => [slot.slotId, slot]))
        const known = new Set(staffIds)

        return {
            maxShiftsPerWeek: data.maxShiftsPerWeek,
            // a response naming a slot or person we didn't send is dropped, not trusted
            assignments: solved.assignments.flatMap(({ slotId, userId }) => {
                const slot = slotById.get(slotId)

                return slot && known.has(userId)
                    ? [{ userId, roleId: slot.roleId, periodId: slot.periodId, shiftDate: slot.date }]
                    : []
            }),
            unfilled: solved.unfilled.flatMap(({ slotId, missing }) => {
                const slot = slotById.get(slotId)

                return slot ? [{ shiftDate: slot.date, periodId: slot.periodId, roleId: slot.roleId, missing }] : []
            }),
            employees,
        }
    }

    /**
     * Writes the kept proposal as shifts in the period's current hours, no register. The proposal
     * came back from the browser, so every row is re-checked: the person is still active at the
     * branch in the role the slot was for, the period is on and offered here, the day is in the
     * week, and — against what's booked by then, inside copy-week's lock — the same rules the
     * proposal followed (`blockReason`): one shift a day, the scheduling rules, the weekly cap.
     * Rows that fail any of it are skipped and counted, first come first kept.
     */
    static async approve(data: ApproveScheduleInput & { createdBy: number }): Promise<CopyWeekResult> {
        const { from, to } = ScheduleBuilderService.weekOf(data.weekStart)

        const [, users, periods, rules] = await Promise.all([
            BranchRepository.assertExists(data.branchId),
            UserRepository.getAllUsers([data.branchId]),
            ShiftPeriodRepository.getPeriodsByBranch(data.branchId),
            ScheduleRuleRepository.getRules(data.branchId),
        ])

        const active = users.filter((user) => user.isActive)
        const roleOf = new Map(active.map((user) => [user.userId, user.roleId]))
        const hours = new Map(periods.map((period) => [period.periodId, period]))
        const valid = data.shifts.filter((shift) =>
            roleOf.get(shift.userId) === shift.roleId
            && hours.has(shift.periodId)
            && shift.shiftDate.getTime() >= from.getTime()
            && shift.shiftDate.getTime() <= to.getTime())

        if (valid.length === 0) {
            return { created: 0, skipped: data.shifts.length }
        }

        const userIds = [...new Set(valid.map((shift) => shift.userId))]
        const staff = active.filter((user) => userIds.includes(user.userId))
        const created = await ShiftRepository.copyIntoWeek(
            {
                branchId: data.branchId,
                from,
                to,
                // partners too, so a keep-apart partner's shift here is in `booked`
                userIds: [...new Set([...userIds, ...partnersOf(rules.keepApart, userIds)])],
                registerIds: [],
            },
            (booked) => {
                const here = booked.filter((shift) => shift.branch_id === data.branchId)
                const employees = ScheduleBuilderService.toEmployees(staff, booked, resolveRestrictions(userIds, rules, here))

                return ScheduleBuilderService.planRows(valid, employees, hours, data)
            },
        )

        return { created, skipped: data.shifts.length - created }
    }

    private static weekOf(weekStart: Date): { from: Date; to: Date } {
        return { from: weekStart, to: addDays(weekStart, DAYS_PER_WEEK - 1) }
    }

    /** The staff's week so far and their rules, with keep-apart partners' shifts at this branch. */
    private static async loadEmployees(
        branchId: number,
        week: { from: Date; to: Date },
        staff: { userId: number; name: string; roleId: number }[],
        rules: ScheduleRules,
    ): Promise<ProposalEmployee[]> {
        const staffIds = staff.map((user) => user.userId)
        const partnerIds = partnersOf(rules.keepApart, staffIds)
        const [weekShifts, partnerShifts] = await Promise.all([
            ShiftRepository.getShifts({ userIds: staffIds, ...week }),
            // keep apart only counts this branch's shifts, and partners may not be up for the week
            partnerIds.length > 0
                ? ShiftRepository.getShifts({ branchId, userIds: partnerIds, ...week })
                : Promise.resolve([]),
        ])

        return ScheduleBuilderService.toEmployees(staff, weekShifts, resolveRestrictions(staffIds, rules, partnerShifts))
    }

    /** The rows approve inserts: each kept only if nothing blocks it, given what's booked and the rows kept before it. */
    private static planRows(
        shifts: ApprovedShift[],
        employees: ProposalEmployee[],
        hours: Map<number, ShiftPeriodView>,
        data: { branchId: number; maxShiftsPerWeek: number; createdBy: number },
    ): NewShiftRow[] {
        const byId = new Map(employees.map((employee) => [employee.userId, employee]))
        const kept: ProposedShift[] = []
        const rows: NewShiftRow[] = []

        for (const shift of shifts) {
            const cell = { shiftDate: toDateOnlyString(shift.shiftDate), periodId: shift.periodId }
            // the caller kept only active staff, in periods offered here
            const person = byId.get(shift.userId) as ProposalEmployee
            const period = hours.get(shift.periodId) as ShiftPeriodView

            if (blockReason(person, cell, kept, data.maxShiftsPerWeek) !== null) {
                continue
            }

            kept.push({ userId: shift.userId, roleId: shift.roleId, ...cell })
            rows.push({
                userId: shift.userId,
                branchId: data.branchId,
                registerId: null,
                periodId: shift.periodId,
                shiftDate: shift.shiftDate,
                startTime: TimeOnlySchema.parse(period.defaultStart),
                endTime: TimeOnlySchema.parse(period.defaultEnd),
                createdBy: data.createdBy,
            })
        }

        return rows
    }

    /**
     * Each person's week so far, across every branch: the days they're booked and how many shifts,
     * with their scheduling rules (`restrictions` has an entry for everyone in `staff`).
     */
    private static toEmployees(
        staff: { userId: number; name: string; roleId: number }[],
        weekShifts: ShiftView[],
        restrictions: Map<number, ScheduleRestriction>,
    ): ProposalEmployee[] {
        return staff
            .map(({ userId, name, roleId }) => {
                const mine = weekShifts.filter((shift) => shift.user_id === userId)

                return {
                    userId,
                    name,
                    roleId,
                    busyDates: [...new Set(mine.map((shift) => shift.shift_date))].toSorted(),
                    existingShifts: mine.length,
                    ...(restrictions.get(userId) as ScheduleRestriction),
                }
            })
            .toSorted((a, b) => a.name.localeCompare(b.name))
    }
}
