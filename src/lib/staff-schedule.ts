import { BranchScheduleShift, BranchScheduleView } from "@/types/shift";

/** One of the viewer's own shifts, from whichever branch it is at. */
export interface MyShift {
    shiftId: number;
    date: string;
    startTime: string;
    endTime: string;
    periodName: string | null;
    registerName: string | null;
    branchName: string;
}

export interface RosterPerson {
    shiftId: number;
    userId: number;
    name: string;
    roleName: string;
    registerName: string | null;
    startTime: string;
    endTime: string;
}

/** A period on one day with whoever works it; `name` is null for shifts on custom hours. */
export interface RosterGroup {
    name: string | null;
    people: RosterPerson[];
}

export interface RosterDay {
    date: string;
    groups: RosterGroup[];
}

function periodNames(schedule: BranchScheduleView): Map<number, string> {
    return new Map(schedule.periods.map((period) => [period.period_id, period.name]));
}

function byDateThenStart(a: { date: string; startTime: string }, b: { date: string; startTime: string }): number {
    return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
}

/** The viewer's shifts across every branch schedule fetched, in the order they happen. */
export function myShifts(schedules: BranchScheduleView[], userId: number): MyShift[] {
    return schedules
        .flatMap((schedule) => {
            const names = periodNames(schedule);
            return schedule.shifts
                .filter((shift) => shift.user_id === userId)
                .map((shift): MyShift => ({
                    shiftId: shift.shift_id,
                    date: shift.shift_date,
                    startTime: shift.start_time,
                    endTime: shift.end_time,
                    periodName: shift.period_id === null ? null : names.get(shift.period_id) ?? null,
                    registerName: shift.register_name,
                    branchName: schedule.branch_name,
                }));
        })
        .toSorted(byDateThenStart);
}

function toPerson(shift: BranchScheduleShift): RosterPerson {
    return {
        shiftId: shift.shift_id,
        userId: shift.user_id,
        name: shift.user_name,
        roleName: shift.role_name,
        registerName: shift.register_name,
        startTime: shift.start_time,
        endTime: shift.end_time,
    };
}

/**
 * Who works each day, grouped by period in the branch's own order, custom-hours shifts last.
 * Periods nobody works that day are left out; a day with no one has no groups.
 */
export function branchRoster(schedule: BranchScheduleView, dates: string[]): RosterDay[] {
    return dates.map((date) => {
        const shifts = schedule.shifts.filter((shift) => shift.shift_date === date);
        const byName = (a: RosterPerson, b: RosterPerson) => a.name.localeCompare(b.name);

        const groups: RosterGroup[] = schedule.periods
            .map((period) => ({
                name: period.name,
                people: shifts.filter((shift) => shift.period_id === period.period_id).map(toPerson).toSorted(byName),
            }))
            .filter((group) => group.people.length > 0);

        // A shift whose period no longer applies to the branch still shows, with its own hours.
        const known = new Set(schedule.periods.map((period) => period.period_id));
        const custom = shifts
            .filter((shift) => shift.period_id === null || !known.has(shift.period_id))
            .map(toPerson)
            .toSorted((a, b) => a.startTime.localeCompare(b.startTime) || byName(a, b));

        return { date, groups: custom.length > 0 ? [...groups, { name: null, people: custom }] : groups };
    });
}
