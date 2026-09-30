import { InvalidRecurrenceError } from '@/exceptions/invalid-recurrence-error';

/**
 * How far ahead instances are generated. Task creation fills [today, today + WINDOW_DAYS];
 * the daily top-up job re-fills the same window every run. The overlap is absorbed by the
 * UNIQUE (task_id, due_date) constraint, which every instance insert relies on.
 */
export const WINDOW_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Postgres `date` columns come back from Prisma as UTC midnight, so every date in this
// module is a UTC-midnight Date. Using local time here would shift due dates by a day
// for anyone running east or west of UTC.
const WEEKDAYS: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
};

/** Strips any time component, returning UTC midnight of the same calendar day. */
export function toUtcDate(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Adds whole days to a date, in UTC. */
export function addDays(date: Date, days: number): Date {
    return new Date(toUtcDate(date).getTime() + days * MS_PER_DAY);
}

/**
 * Expands a recurrence rule into the concrete dates it lands on within [from, to], inclusive.
 *
 *   'daily'          -> every date in the range
 *   'weekly:mon,wed' -> only those weekdays in the range
 *   anything else    -> throws InvalidRecurrenceError
 *
 * Pure: no clock, no database. Both task creation and the daily top-up job go through it.
 */
export function getDates(rule: string, from: Date, to: Date): Date[] {
    if (typeof rule !== 'string') {
        throw new InvalidRecurrenceError();
    }

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new InvalidRecurrenceError('Recurrence range must be two valid dates');
    }

    const allowedWeekdays = parseRule(rule);

    const start = toUtcDate(from);
    const end = toUtcDate(to);

    const dates: Date[] = [];

    // An inverted range is empty rather than an error: the top-up job can legitimately
    // ask for a window that has already passed.
    for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
        if (allowedWeekdays === null || allowedWeekdays.has(cursor.getUTCDay())) {
            dates.push(cursor);
        }
    }

    return dates;
}

/**
 * Which of the given pending instances the rule no longer accounts for. `validDates` is what the
 * rule currently expands to; `pending` is what actually exists. Anything present but not expected
 * is surplus. Pure — no clock, no database. Compared at UTC midnight, so a `dueDate` with a time
 * component still matches. Caller must not pass `validDates: []` for a rule that failed to parse —
 * that means 'unknown', not 'nothing'.
 */
export function surplusInstanceIds(
    validDates: readonly Date[],
    pending: readonly { instanceId: number; dueDate: Date }[],
): number[] {
    const expected = new Set(validDates.map((date) => toUtcDate(date).getTime()));

    return pending
        .filter((instance) => !expected.has(toUtcDate(instance.dueDate).getTime()))
        .map((instance) => instance.instanceId);
}

/** Returns null for 'daily' (every day allowed), or the set of weekday numbers for 'weekly:...'. */
function parseRule(rule: string): Set<number> | null {
    const normalized = rule.trim().toLowerCase();

    if (normalized === 'daily') {
        return null;
    }

    if (!normalized.startsWith('weekly:')) {
        throw new InvalidRecurrenceError(`Unsupported recurrence rule: '${rule}'`);
    }

    const dayList = normalized.slice('weekly:'.length);
    const tokens = dayList.split(',').map((token) => token.trim());

    if (tokens.length === 0 || tokens.some((token) => token === '')) {
        throw new InvalidRecurrenceError(`Recurrence rule '${rule}' lists no weekdays`);
    }

    const weekdays = new Set<number>();

    for (const token of tokens) {
        const weekday = WEEKDAYS[token];

        if (weekday === undefined) {
            throw new InvalidRecurrenceError(`Unknown weekday '${token}' in recurrence rule '${rule}'`);
        }

        weekdays.add(weekday);
    }

    return weekdays;
}

/** True when the rule is one getDates can expand. Used to validate before writing a task. */
export function isValidRecurrence(rule: string): boolean {
    try {
        parseRule(rule);
        return true;
    } catch {
        return false;
    }
}
