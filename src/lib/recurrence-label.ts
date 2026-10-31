import { en, type Dictionary } from "@/i18n/dictionaries/en";

export type RecurrenceWords = Dictionary["tasks"]["recurrence"];

/** Turns a stored recurrence rule ('daily', 'weekly:mon,wed') into text for a table cell. A task with no rule is a one-off. */
export function describeRecurrence(recurrence: string | null, words: RecurrenceWords = en.tasks.recurrence): string {
    if (recurrence === null) return words.oneOff;
    if (recurrence === "daily") return words.daily;

    const [kind, days] = recurrence.split(":");
    if (kind !== "weekly" || !days) return recurrence;

    return words.weekly(days.split(",").map((day) => words.weekdays[day as keyof RecurrenceWords["weekdays"]] ?? day));
}
