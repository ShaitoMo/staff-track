import type { InstanceRow } from "@/lib/instance-rows";

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

/** A staff card: one task copy, or for an overdue run, its latest copy standing for all of them. */
export type StaffTaskRow = InstanceRow & {
    /** How many overdue copies this card stands for; 1 for anything not overdue. */
    missedDays: number;
    /** The earliest of those copies' due days. */
    oldestDueDate: string;
};

/**
 * One card per task for the copies a recurring task left overdue, so a missed daily task doesn't
 * fill the screen with identical cards. The card is the latest missed copy: that is the one its
 * photo completes, and the older ones stay overdue for the manager. Sorted by due day, then title.
 */
export function collapseOverdue(rows: InstanceRow[], today: string): StaffTaskRow[] {
    const kept: StaffTaskRow[] = [];
    const overdueByTask = new Map<number, StaffTaskRow>();

    for (const row of rows) {
        if (row.status !== "pending" || row.dueDate >= today) {
            kept.push({ ...row, missedDays: 1, oldestDueDate: row.dueDate });
            continue;
        }
        const run = overdueByTask.get(row.taskId);
        if (run === undefined) {
            overdueByTask.set(row.taskId, { ...row, missedDays: 1, oldestDueDate: row.dueDate });
            continue;
        }
        const latest = row.dueDate > run.dueDate ? row : run;
        overdueByTask.set(row.taskId, {
            ...latest,
            missedDays: run.missedDays + 1,
            oldestDueDate: row.dueDate < run.oldestDueDate ? row.dueDate : run.oldestDueDate,
        });
    }

    return [...overdueByTask.values(), ...kept].toSorted(
        (a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title),
    );
}
