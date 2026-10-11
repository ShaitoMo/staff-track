export const WEEKDAY_LABELS: Record<string, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
};

/** Turns a stored recurrence rule ('daily', 'weekly:mon,wed') into text for a table cell. A task with no rule is a one-off. */
export function describeRecurrence(recurrence: string | null): string {
    if (recurrence === null) return "One-off";
    if (recurrence === "daily") return "Daily";

    const [kind, days] = recurrence.split(":");
    if (kind !== "weekly" || !days) return recurrence;

    return `Weekly: ${days.split(",").map((day) => WEEKDAY_LABELS[day] ?? day).join(", ")}`;
}
