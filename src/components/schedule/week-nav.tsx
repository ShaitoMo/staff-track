import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { addDays } from "@/lib/coverage-rows";
import { formatWeekRange } from "@/lib/schedule-grid";
import { cn } from "@/lib/utils";

/** Touch screens get a full 44px tap target; mouse layouts keep the compact size. */
const touch = "[@media(pointer:coarse)]:size-11";

function weekHref(query: Record<string, string>, weekStart: string): string {
    return `/schedule?${new URLSearchParams({ ...query, week: weekStart })}`;
}

/** ‹ 28 Sep – 4 Oct ›, plus a way back to the current week. `query` carries the page's other params (e.g. branch). */
export function WeekNav({ weekStart, thisWeek, query }: { weekStart: string; thisWeek: string; query: Record<string, string> }) {
    return (
        <div className="flex items-center gap-1">
            <Link
                href={weekHref(query, addDays(weekStart, -7))}
                scroll={false}
                aria-label="Previous week"
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), touch)}
            >
                <ChevronLeftIcon />
            </Link>
            <h2 className="min-w-32 px-1 text-center text-sm font-medium tabular-nums">{formatWeekRange(weekStart)}</h2>
            <Link
                href={weekHref(query, addDays(weekStart, 7))}
                scroll={false}
                aria-label="Next week"
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), touch)}
            >
                <ChevronRightIcon />
            </Link>
            {weekStart === thisWeek ? (
                <span className="ml-2 text-xs text-muted-foreground">This week</span>
            ) : (
                <Link
                    href={weekHref(query, thisWeek)}
                    scroll={false}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-1 [@media(pointer:coarse)]:h-11")}
                >
                    Back to this week
                </Link>
            )}
        </div>
    );
}
