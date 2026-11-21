import { getI18n } from "@/i18n/server";
import { formatMinutes } from "@/lib/attendance-rows";
import { LATE_GRACE_MINUTES } from "@/lib/schedule-vs-actual";

/**
 * The time lost to slips over the week on My attendance — what a staff member checks, since it
 * affects their pay, so the grace rule is told with it.
 */
export async function MissedTime({
    title,
    minutes,
    pending,
    noShows = 0,
}: {
    title: string;
    minutes: number;
    /** Shifts still missing a punch, which aren't counted until a manager adds it. */
    pending: number;
    /** Shifts nobody clocked, which aren't minutes missed; said so, so "No time missed" doesn't read as all clear. */
    noShows?: number;
}) {
    const { t, locale } = await getI18n();

    return (
        <section aria-labelledby="missed-time" className="flex flex-col gap-1">
            <h2 id="missed-time" className="text-sm font-medium text-muted-foreground">
                {title}
            </h2>
            {/* a figure to check, not the page's headline: no bigger than a day heading */}
            <p className="text-lg font-semibold tabular-nums">{minutes === 0 ? t.attendance.noTimeMissed : formatMinutes(minutes, locale)}</p>
            {/* the pay rule only matters once there is time to explain */}
            {minutes > 0 ? <p className="text-sm text-muted-foreground">{t.attendance.affectsPay(LATE_GRACE_MINUTES)}</p> : null}
            {pending > 0 ? (
                <p className="text-sm text-muted-foreground">{t.attendance.pendingNote(pending)}</p>
            ) : null}
            {noShows > 0 ? (
                <p className="text-sm text-muted-foreground">{t.attendance.noShowsNote(noShows)}</p>
            ) : null}
        </section>
    );
}
