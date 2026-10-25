import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { addDays, mondayOf } from "@/lib/coverage-rows";
import { CHOSEN } from "@/lib/selection";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

export type AttendanceRange = "day" | "week";

/**
 * Day | Week. Switching keeps you where you were: a day opens its week, and a week opens on today
 * when today is in it, otherwise on its Monday. `query` carries the page's other params (branch).
 */
export function RangeSwitch({
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
    const dayDate = view === "day" ? from : today >= from && today <= addDays(from, 6) ? today : from;
    const links: [AttendanceRange, string, Record<string, string>][] = [
        ["day", "Day", { date: dayDate }],
        ["week", "Week", { week: mondayOf(from) }],
    ];

    return (
        <nav aria-label="Range" className="flex items-center gap-1">
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
