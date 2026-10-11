/**
 * The clock-in machines report wall-clock readings with no zone ('7/1/2026', '3:00:00 PM'), but
 * the column is `timestamptz` — resolving one needs the zone the machine stands in. One constant
 * for now; if branches ever span zones this becomes a column on `branches` instead.
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
 * The calendar day an instant falls on **in Beirut**, as UTC midnight — same anchor as `toUtcDate`
 * in `lib/recurrence.ts` (Postgres `date` columns come back at UTC midnight), with the zone
 * applied first. Fixes *which* day it is: `toUtcDate(new Date())` answers with the UTC day, and
 * Beirut runs 2-3 hours ahead, so 'today' came back as yesterday between local and UTC midnight.
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
 * A machine reading to the instant it happened. Beirut's offset is +02:00/+03:00 by season, so a
 * naive guess is corrected once against itself — enough to handle a reading inside a DST shift.
 * The hour DST skips doesn't exist on the clock; a reading inside it resolves to the instant the
 * clock jumped to, rather than being rejected, since a machine can only report what its clock showed.
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
