import type { InstanceRow } from "@/lib/instance-rows";
import type { MyShift } from "@/lib/staff-schedule";

/** The 1st of the month a 'YYYY-MM-DD' day falls in. */
export function monthStart(date: string): string {
    return `${date.slice(0, 7)}-01`;
}

/** Splits dated items into today's and tomorrow's; anything overdue lands under today. */
export function splitByDay<T>(items: T[], dateOf: (item: T) => string, today: string): { today: T[]; tomorrow: T[] } {
    return {
        today: items.filter((item) => dateOf(item) <= today),
        tomorrow: items.filter((item) => dateOf(item) > today),
    };
}

/** Where today's shifts stand at a given 'HH:MM': the one on now, the next one, or all over. */
export type ShiftNow =
    | { kind: "on"; shift: MyShift; minutesLeft: number; next: MyShift | null }
    | { kind: "later"; shift: MyShift; next: MyShift | null }
    | { kind: "done"; shift: MyShift }
    | { kind: "none" };

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * The Now block's answer for today's shifts. A shift is "on" from its start up to (not at) its end;
 * shifts never cross midnight (end is after start), so today's shifts and the clock are enough.
 */
export function shiftNow(todayShifts: MyShift[], clock: string): ShiftNow {
    const shifts = todayShifts.toSorted((a, b) => a.startTime.localeCompare(b.startTime));
    const now = minutesOf(clock);
    const index = shifts.findIndex((shift) => minutesOf(shift.endTime) > now);

    if (shifts.length === 0) return { kind: "none" };
    if (index === -1) return { kind: "done", shift: shifts[shifts.length - 1] };

    const shift = shifts[index];
    const next = shifts[index + 1] ?? null;
    return minutesOf(shift.startTime) <= now
        ? { kind: "on", shift, minutesLeft: minutesOf(shift.endTime) - now, next }
        : { kind: "later", shift, next };
}

/** A recurring task's missed copies, as one line: staff can't do them any more, the manager sees them. */
export interface MissedRun {
    taskId: number;
    title: string;
    branchName: string;
    days: number;
    oldestDueDate: string;
}

/**
 * Sorts pending work into what a staff member can still do and what's gone. Only today's copy of a
 * recurring task can be done; its missed copies fold into one MissedRun per task. A one-off past its
 * day stays doable (it has no other copy). Doable work is sorted overdue first, then by title.
 */
export function splitMissed(rows: InstanceRow[], today: string): { doable: InstanceRow[]; missed: MissedRun[] } {
    const doable: InstanceRow[] = [];
    const runs = new Map<number, MissedRun>();

    for (const row of rows) {
        if (!(row.recurring && row.status === "pending" && row.dueDate < today)) {
            doable.push(row);
            continue;
        }
        const run = runs.get(row.taskId);
        runs.set(row.taskId, {
            taskId: row.taskId,
            title: row.title,
            branchName: row.branchName,
            days: (run?.days ?? 0) + 1,
            oldestDueDate: run === undefined || row.dueDate < run.oldestDueDate ? row.dueDate : run.oldestDueDate,
        });
    }

    return {
        doable: doable.toSorted((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title)),
        missed: [...runs.values()].toSorted((a, b) => b.days - a.days || a.title.localeCompare(b.title)),
    };
}

/** Puts the branch someone is working at first, keeping each branch's own order; the rest follow by name. */
export function branchFirst<T extends { branchName: string }>(items: T[], branchName: string | null): T[] {
    return items.toSorted((a, b) => Number(b.branchName === branchName) - Number(a.branchName === branchName) || a.branchName.localeCompare(b.branchName));
}
