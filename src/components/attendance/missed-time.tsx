import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { formatMinutes } from "@/lib/attendance-rows";
import { LATE_GRACE_MINUTES } from "@/lib/schedule-vs-actual";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

/** A staff-facing text link, tall enough to tap on a phone (DESIGN.md: 44px on touch screens). */
export const staffLinkClass = cn("inline-flex items-center text-sm text-primary underline-offset-4 hover:underline", TOUCH_HEIGHT);

/**
 * The time lost to slips — what a staff member checks, since it affects their pay. One wording for
 * My attendance (a week) and the home page (this month), so the grace rule is told the same way.
 */
export async function MissedTime({
    title,
    minutes,
    pending,
    noShows = 0,
    link,
    className,
}: {
    title: string;
    minutes: number;
    /** Shifts still missing a punch, which aren't counted until a manager adds it. */
    pending: number;
    /** Shifts nobody clocked, which aren't minutes missed; said so, so "No time missed" doesn't read as all clear. */
    noShows?: number;
    link?: { href: string; label: string };
    className?: string;
}) {
    const { t, locale } = await getI18n();

    return (
        <section aria-labelledby="missed-time" className={cn("flex flex-col gap-1", className)}>
            <div className="flex items-center justify-between gap-3">
                <h2 id="missed-time" className="text-sm font-medium text-muted-foreground">
                    {title}
                </h2>
                {link ? (
                    <Link href={link.href} className={staffLinkClass}>
                        {link.label}
                    </Link>
                ) : null}
            </div>
            <p className="text-2xl font-semibold tabular-nums">{minutes === 0 ? t.attendance.noTimeMissed : formatMinutes(minutes, locale)}</p>
            <p className="text-sm text-muted-foreground">{t.attendance.affectsPay(LATE_GRACE_MINUTES)}</p>
            {pending > 0 ? (
                <p className="text-sm text-muted-foreground">{t.attendance.pendingNote(pending)}</p>
            ) : null}
            {noShows > 0 ? (
                <p className="text-sm text-muted-foreground">{t.attendance.noShowsNote(noShows)}</p>
            ) : null}
        </section>
    );
}
