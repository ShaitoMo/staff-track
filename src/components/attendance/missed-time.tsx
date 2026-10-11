import Link from "next/link";
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
export function MissedTime({
    title,
    minutes,
    pending,
    link,
    className,
}: {
    title: string;
    minutes: number;
    /** Shifts still missing a punch, which aren't counted until a manager adds it. */
    pending: number;
    link?: { href: string; label: string };
    className?: string;
}) {
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
            <p className="text-2xl font-semibold tabular-nums">{minutes === 0 ? "No time missed" : formatMinutes(minutes)}</p>
            <p className="text-sm text-muted-foreground">
                Affects your pay. Counts late arrivals and early leaves past the {LATE_GRACE_MINUTES}-minute grace period.
            </p>
            {pending > 0 ? (
                <p className="text-sm text-muted-foreground">
                    {pending === 1 ? "1 shift is" : `${pending} shifts are`} missing a punch and not counted until your branch
                    manager adds it.
                </p>
            ) : null}
        </section>
    );
}
