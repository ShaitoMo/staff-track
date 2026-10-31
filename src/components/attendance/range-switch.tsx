import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getDictionary } from "@/i18n/server";
import { addDays, mondayOf } from "@/lib/coverage-rows";
import { CHOSEN } from "@/lib/selection";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

export type AttendanceRange = "day" | "week";

/**
 * Day | Week. Switching keeps you where you were: a day opens its week, and a week opens on today
 * when today is in it, otherwise on its Monday. `query` carries the page's other params (branch).
 */
export async function RangeSwitch({
    view,
    from,
    today,
    query,
}: {
    view: AttendanceRange;
    /** The day shown, or the week's Monday. */
    from: string;
    today: string;
    query: Record<string, string>;
}) {
    const t = await getDictionary();
    const dayDate = view === "day" ? from : today >= from && today <= addDays(from, 6) ? today : from;
    const links: [AttendanceRange, string, Record<string, string>][] = [
        ["day", t.attendance.day, { date: dayDate }],
        ["week", t.attendance.week, { week: mondayOf(from) }],
    ];

    return (
        <nav aria-label={t.attendance.rangeLabel} className="flex items-center gap-1">
            {links.map(([value, label, params]) => (
                <Link
                    key={value}
                    href={`/attendance?${new URLSearchParams({ ...query, ...params })}`}
                    scroll={false}
                    aria-current={view === value ? "page" : undefined}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), TOUCH_HEIGHT, view === value && CHOSEN)}
                >
                    {label}
                </Link>
            ))}
        </nav>
    );
}
