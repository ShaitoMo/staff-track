import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { addDays, formatDay } from "@/lib/coverage-rows";
import { TOUCH_HEIGHT, TOUCH_SIZE } from "@/lib/touch";
import { cn } from "@/lib/utils";

/** ‹ Wed 30 Sep ›, plus a way back to today. The day sibling of WeekNav; links set `?date=`. */
export function DayNav({ basePath, date, today }: { basePath: string; date: string; today: string }) {
    const dayHref = (day: string) => `${basePath}?${new URLSearchParams({ date: day })}`;

    return (
        <div className="flex items-center gap-1">
            <Link
                href={dayHref(addDays(date, -1))}
                scroll={false}
                aria-label="Previous day"
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), TOUCH_SIZE)}
            >
                <ChevronLeftIcon />
            </Link>
            <h2 className="min-w-28 px-1 text-center text-sm font-medium tabular-nums">{formatDay(date)}</h2>
            <Link
                href={dayHref(addDays(date, 1))}
                scroll={false}
                aria-label="Next day"
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), TOUCH_SIZE)}
            >
                <ChevronRightIcon />
            </Link>
            {date === today ? (
                <span className="ml-2 text-xs text-muted-foreground">Today</span>
            ) : (
                <Link href={dayHref(today)} scroll={false} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-1", TOUCH_HEIGHT)}>
                    Back to today
                </Link>
            )}
        </div>
    );
}
