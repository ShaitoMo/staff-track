/**
 * The clock-in machines report wall-clock readings with no zone: '7/1/2026', '3:00:00 PM'. The
 * column they land in is `timestamptz`, so each reading has to be resolved to the instant it
 * actually happened, which needs the zone the machine stands in.
 *
 * One constant for the whole business today. If branches ever span zones this becomes a column on
 * `branches` and a parameter here — nothing else changes.
 */
export const MACHINE_TIME_ZONE = 'Asia/Beirut';

const zoneParts = new Intl.DateTimeFormat('en-US', {
    timeZone: MACHINE_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

/** The zone's offset from UTC, in ms, at a given instant — DST included. */
function offsetAt(instant: number): number {
    const parts = zoneParts.formatToParts(new Date(instant));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);

    // some ICU builds render midnight as hour 24 under hour12: false
    const asUtc = Date.UTC(
        part('year'),
        part('month') - 1,
        part('day'),
        part('hour') % 24,
        part('minute'),
        part('second'),
    );

    return asUtc - instant;
}

/**
 * The calendar day an instant falls on **in Beirut**, as UTC midnight.
 *
 * The anchor matches the one every other date in the codebase uses: Postgres `date` columns come
 * back from Prisma at UTC midnight, so a day meant for comparison against `due_date` has to be
 * anchored the same way. This is `toUtcDate` from `lib/recurrence.ts` with the zone applied first,
 * and it returns the identical shape — only the answer differs, and only near midnight.
 *
 * What it fixes is *which* day it is. `toUtcDate(new Date())` answers with the UTC calendar day,
 * and Beirut runs two to three hours ahead of it — so every night between local midnight and
 * 02:00 or 03:00, 'today' came back as yesterday. Anything generating or pruning a window from
 * that answer was working a day behind the branch it serves.
 */
export function machineDayOf(instant: Date): Date {
    const wallClock = new Date(instant.getTime() + offsetAt(instant.getTime()));

    return new Date(Date.UTC(
        wallClock.getUTCFullYear(),
        wallClock.getUTCMonth(),
        wallClock.getUTCDate(),
    ));
}

/**
 * A machine reading to the instant it happened.
 *
 * Beirut is +02:00 in winter and +03:00 in summer, so the offset cannot be a constant: it depends
 * on the very instant being computed. The naive guess is corrected once, which is enough — only a
 * reading inside a DST shift lands under a different offset than the guess assumed.
 *
 * The hour that DST skips does not exist on the clock; a reading inside it is resolved to the
 * instant the clock jumped to, rather than rejected, because a machine can only ever report a time
 * that its own clock displayed.
 */
export function machineTimeToUtc(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
    seconds = 0,
): Date {
    const naive = Date.UTC(year, month - 1, day, hours, minutes, seconds);
    const guess = naive - offsetAt(naive);

    return new Date(naive - offsetAt(guess));
}
