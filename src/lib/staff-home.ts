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
