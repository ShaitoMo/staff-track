import { weekDates } from "@/lib/coverage-rows";
import { CoverageRequirementView } from "@/types/coverage-requirement";
import { Register } from "@/types/register";
import { Role } from "@/types/role";
import { ShiftView } from "@/types/shift";
import { ShiftPeriodView } from "@/types/shift-period";
import { SafeUser } from "@/types/user";

/**
 * The one red mark in the schedule grid: a dot before "Needs N" on a slot that still needs someone.
 * A dot, not a cell fill — when most of a week is short, filled cells turn the grid pink and stop
 * reading as a signal. Shared by the grid, its legend, and the phone day strip.
 */
export const NEEDS_DOT = "inline-block size-1.5 shrink-0 rounded-full bg-destructive";

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

/** The one key format for a (day, period) slot — the server builds with it and the grid reads with it. */
export function slotKey(date: string, periodId: number): string {
    return `${date}:${periodId}`;
}

function nameOf(names: Map<number, string>, userId: number): string {
    return names.get(userId) ?? `User ${userId}`;
}

/** The week's lookups, built once in indexWeek and shared by every builder below. */
export interface WeekIndex {
    names: Map<number, string>;
    roleOf: Map<number, number>;
    /** Period-based shifts by slotKey(date, periodId), each as a chip, sorted by name. */
    slots: Map<string, SchedulePerson[]>;
}

export function indexWeek(shifts: ShiftView[], users: SafeUser[], registers: Register[]): WeekIndex {
    const names = new Map(users.map((user) => [user.userId, user.name]));
    const roleOf = new Map(users.map((user) => [user.userId, user.roleId]));
    const registerNames = new Map(registers.map((register) => [register.registerId, register.name]));
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

    return { names, roleOf, slots };
}

/** The slots as a plain object, so they can cross to the client grid already grouped. */
export function slotsForClient(week: WeekIndex): Record<string, SchedulePerson[]> {
    return Object.fromEntries(week.slots);
}

/**
 * One row per period × role that has a requirement or anyone scheduled this week, one cell per day.
 * Period-first, in the order `periods` arrives (sortPeriods), so a period's roles sit together.
 * A person's role is their current one — the same join coverage uses (see CoverageRepository).
 * Roles not in `roles` (e.g. owner, hidden from a manager) get no row.
 */
export function buildRoleRows(
    shifts: ShiftView[],
    week: WeekIndex,
    roles: Role[],
    periods: ShiftPeriodView[],
    requirements: CoverageRequirementView[],
    weekStart: string,
): RoleRow[] {
    const dates = weekDates(weekStart);
    const { roleOf, slots } = week;

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
export function rolesOnRegisters(shifts: ShiftView[], week: WeekIndex): number[] {
    return [
        ...new Set(
            shifts.flatMap((shift) => {
                const roleId = week.roleOf.get(shift.user_id);
                return shift.register_id === null || roleId === undefined ? [] : [roleId];
            }),
        ),
    ];
}

/** One row per period, every day: each register needs exactly one person per period. */
export function buildOpenRegisterRows(
    week: WeekIndex,
    registers: Register[],
    periods: ShiftPeriodView[],
    weekStart: string,
): OpenRegisterRow[] {
    const dates = weekDates(weekStart);
    const { slots } = week;
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

export function toOtherShifts(shifts: ShiftView[], week: WeekIndex): OtherShift[] {
    return shifts.flatMap((shift) =>
        shift.period_id !== null
            ? []
            : [{
                shiftId: shift.shift_id,
                name: nameOf(week.names, shift.user_id),
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
