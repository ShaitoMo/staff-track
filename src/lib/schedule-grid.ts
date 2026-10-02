import { addDays, formatDay } from "@/lib/coverage-rows";
import { CoverageRequirementView } from "@/types/coverage-requirement";
import { Register } from "@/types/register";
import { Role } from "@/types/role";
import { ShiftView } from "@/types/shift";
import { ShiftPeriodView } from "@/types/shift-period";
import { SafeUser } from "@/types/user";

const DAYS_IN_WEEK = 7;

/** The one highlight in the schedule grid: a slot that still needs someone. Shared by the grid and its legend. */
export const NEEDS_TINT = "bg-destructive/6";

export function weekDates(weekStart: string): string[] {
    return Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(weekStart, index));
}

/** Someone on a shift, as a chip in a cell. */
export interface SchedulePerson {
    shiftId: number;
    userId: number;
    name: string;
    registerId: number | null;
    registerName: string | null;
}

export interface RoleCell {
    date: string;
    people: SchedulePerson[];
    required: number;
    /** Distinct people, matching how coverage counts — one person twice in a slot covers it once. */
    scheduled: number;
    shortfall: number;
}

export interface RoleRow {
    roleId: number;
    roleName: string;
    periodId: number;
    periodName: string;
    cells: RoleCell[];
}

export interface RegisterSeat {
    registerId: number;
    name: string;
}

/**
 * Registers for one (date, period): the ones nobody works (each needs one person) and the ones
 * more than one person was put on — a mistake to fix. Everyone seated correctly shows on their
 * role row instead, so nobody is listed twice.
 */
export interface OpenRegisterCell {
    date: string;
    open: RegisterSeat[];
    crowded: { registerId: number; name: string; people: SchedulePerson[] }[];
}

export interface OpenRegisterRow {
    periodId: number;
    cells: OpenRegisterCell[];
}

/** A period-based shift, flattened for the client's "who is free in this slot" lookups. */
export interface SlotShift {
    shiftId: number;
    userId: number;
    periodId: number;
    date: string;
    registerId: number | null;
}

/** A shift with custom hours — it belongs to no period, so it has no cell. */
export interface OtherShift {
    shiftId: number;
    name: string;
    date: string;
    startTime: string;
    endTime: string;
}

export interface StaffMember {
    userId: number;
    name: string;
    roleId: number;
}

function slotKey(date: string, periodId: number): string {
    return `${date}:${periodId}`;
}

function nameOf(names: Map<number, string>, userId: number): string {
    return names.get(userId) ?? `User ${userId}`;
}

/** Period-based shifts grouped by (date, period), each turned into a chip. */
function groupBySlot(
    shifts: ShiftView[],
    names: Map<number, string>,
    registerNames: Map<number, string>,
): Map<string, SchedulePerson[]> {
    const slots = new Map<string, SchedulePerson[]>();

    for (const shift of shifts) {
        if (shift.period_id === null) continue;

        const key = slotKey(shift.shift_date, shift.period_id);
        const people = slots.get(key) ?? [];
        people.push({
            shiftId: shift.shift_id,
            userId: shift.user_id,
            name: nameOf(names, shift.user_id),
            registerId: shift.register_id,
            registerName: shift.register_id === null ? null : registerNames.get(shift.register_id) ?? null,
        });
        slots.set(key, people);
    }

    for (const people of slots.values()) {
        people.sort((a, b) => a.name.localeCompare(b.name));
    }

    return slots;
}

/**
 * One row per period × role that has a requirement or anyone scheduled this week, one cell per day.
 * Period-first, in the order `periods` arrives (sortPeriods), so a period's roles sit together.
 * A person's role is their current one — the same join coverage uses (see CoverageRepository).
 * Roles not in `roles` (e.g. owner, hidden from a manager) get no row.
 */
export function buildRoleRows(
    shifts: ShiftView[],
    users: SafeUser[],
    roles: Role[],
    periods: ShiftPeriodView[],
    requirements: CoverageRequirementView[],
    registers: Register[],
    weekStart: string,
): RoleRow[] {
    const dates = weekDates(weekStart);
    const names = new Map(users.map((user) => [user.userId, user.name]));
    const roleOf = new Map(users.map((user) => [user.userId, user.roleId]));
    const registerNames = new Map(registers.map((register) => [register.registerId, register.name]));
    const slots = groupBySlot(shifts, names, registerNames);

    const required = new Map(
        requirements.map((requirement) => [`${requirement.role.roleId}:${requirement.period.periodId}`, requirement.requiredCount]),
    );
    const staffed = new Set(
        shifts.flatMap((shift) => {
            const roleId = roleOf.get(shift.user_id);
            return shift.period_id === null || roleId === undefined ? [] : [`${roleId}:${shift.period_id}`];
        }),
    );

    const sortedRoles = roles.toSorted((a, b) => a.name.localeCompare(b.name));

    return periods.flatMap((period) =>
        sortedRoles
            .filter((role) => required.has(`${role.roleId}:${period.periodId}`) || staffed.has(`${role.roleId}:${period.periodId}`))
            .map((role): RoleRow => ({
                roleId: role.roleId,
                roleName: role.name,
                periodId: period.periodId,
                periodName: period.name,
                cells: dates.map((date): RoleCell => {
                    const people = (slots.get(slotKey(date, period.periodId)) ?? [])
                        .filter((person) => roleOf.get(person.userId) === role.roleId);
                    const needed = required.get(`${role.roleId}:${period.periodId}`) ?? 0;
                    const scheduled = new Set(people.map((person) => person.userId)).size;
                    return { date, people, required: needed, scheduled, shortfall: Math.max(0, needed - scheduled) };
                }),
            })),
    );
}

/**
 * Roles whose people work a register this week. No role is tied to registers in the data, so this
 * is read from the schedule itself; the grid offers register choices only on these rows, or on
 * every row while nobody is on a register yet (so an empty week can still be started).
 */
export function rolesOnRegisters(shifts: ShiftView[], users: SafeUser[]): number[] {
    const roleOf = new Map(users.map((user) => [user.userId, user.roleId]));

    return [
        ...new Set(
            shifts.flatMap((shift) => {
                const roleId = roleOf.get(shift.user_id);
                return shift.register_id === null || roleId === undefined ? [] : [roleId];
            }),
        ),
    ];
}

/** One row per period, every day: each register needs exactly one person per period. */
export function buildOpenRegisterRows(
    shifts: ShiftView[],
    users: SafeUser[],
    registers: Register[],
    periods: ShiftPeriodView[],
    weekStart: string,
): OpenRegisterRow[] {
    const dates = weekDates(weekStart);
    const names = new Map(users.map((user) => [user.userId, user.name]));
    const registerNames = new Map(registers.map((register) => [register.registerId, register.name]));
    const slots = groupBySlot(shifts, names, registerNames);
    const sortedRegisters = registers.toSorted((a, b) => a.name.localeCompare(b.name));

    return periods.map((period) => ({
        periodId: period.periodId,
        cells: dates.map((date): OpenRegisterCell => {
            const people = slots.get(slotKey(date, period.periodId)) ?? [];
            const seated = (registerId: number) => people.filter((person) => person.registerId === registerId);

            return {
                date,
                open: sortedRegisters
                    .filter((register) => seated(register.registerId).length === 0)
                    .map((register) => ({ registerId: register.registerId, name: register.name })),
                crowded: sortedRegisters
                    .filter((register) => seated(register.registerId).length > 1)
                    .map((register) => ({ registerId: register.registerId, name: register.name, people: seated(register.registerId) })),
            };
        }),
    }));
}

export function toSlotShifts(shifts: ShiftView[]): SlotShift[] {
    return shifts.flatMap((shift) =>
        shift.period_id === null
            ? []
            : [{
                shiftId: shift.shift_id,
                userId: shift.user_id,
                periodId: shift.period_id,
                date: shift.shift_date,
                registerId: shift.register_id,
            }],
    );
}

export function toOtherShifts(shifts: ShiftView[], users: SafeUser[]): OtherShift[] {
    const names = new Map(users.map((user) => [user.userId, user.name]));

    return shifts.flatMap((shift) =>
        shift.period_id !== null
            ? []
            : [{
                shiftId: shift.shift_id,
                name: nameOf(names, shift.user_id),
                date: shift.shift_date,
                startTime: shift.start_time,
                endTime: shift.end_time,
            }],
    );
}

/** Active people only — someone switched off can't be given new shifts, though their old ones still show. */
export function toStaff(users: SafeUser[]): StaffMember[] {
    return users
        .filter((user) => user.isActive)
        .map(({ userId, name, roleId }) => ({ userId, name, roleId }))
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** What the week still needs, counted per cell — the line above the grid. */
export interface WeekSummary {
    /** Role cells with fewer people than required. */
    shortSlots: number;
    /** People missing across those cells. */
    peopleShort: number;
    unstaffedRegisters: number;
    /** Register cells with more than one person — a mistake to fix, not coverage. */
    crowdedRegisters: number;
}

export function summarizeWeek(roleRows: RoleRow[], openRegisterRows: OpenRegisterRow[]): WeekSummary {
    const roleCells = roleRows.flatMap((row) => row.cells);
    const registerCells = openRegisterRows.flatMap((row) => row.cells);

    return {
        shortSlots: roleCells.filter((cell) => cell.shortfall > 0).length,
        peopleShort: roleCells.reduce((total, cell) => total + cell.shortfall, 0),
        unstaffedRegisters: registerCells.reduce((total, cell) => total + cell.open.length, 0),
        crowdedRegisters: registerCells.reduce((total, cell) => total + cell.crowded.length, 0),
    };
}

/** '28 Sep – 4 Oct', in UTC like formatDay, so the label never slips a day with the viewer's zone. */
export function formatWeekRange(weekStart: string): string {
    // formatDay without the weekday, so both read 'Sep' rather than en-GB's 'Sept'
    const day = (dateString: string) => formatDay(dateString).split(" ").slice(1).join(" ");

    return `${day(weekStart)} – ${day(addDays(weekStart, DAYS_IN_WEEK - 1))}`;
}
