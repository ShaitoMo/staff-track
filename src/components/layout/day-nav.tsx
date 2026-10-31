import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { addDays, formatDay } from "@/lib/coverage-rows";
import { TOUCH_HEIGHT, TOUCH_SIZE } from "@/lib/touch";
import { cn } from "@/lib/utils";

/**
 * ‹ Wed 30 Sep ›, plus a way back to today. The day sibling of WeekNav; links keep the page's other
 * params (`query`, e.g. branch) and set `?date=`.
 */
export async function DayNav({
    basePath,
    date,
    today,
    query = {},
}: {
    basePath: string;
    date: string;
    today: string;
    query?: Record<string, string>;
}) {
    const { t, locale } = await getI18n();
    const dayHref = (day: string) => `${basePath}?${new URLSearchParams({ ...query, date: day })}`;

    return (
        <div className="flex items-center gap-1">
            <Link
                href={dayHref(addDays(date, -1))}
                scroll={false}
                aria-label={t.layout.previousDay}
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), TOUCH_SIZE)}
            >
                <ChevronLeftIcon className="rtl:rotate-180" />
            </Link>
            {/* not a heading: it labels the controls, and is announced when the day changes */}
            <p aria-live="polite" className="min-w-28 px-1 text-center text-sm font-medium tabular-nums">
                {formatDay(date, locale)}
            </p>
            <Link
                href={dayHref(addDays(date, 1))}
                scroll={false}
                aria-label={t.layout.nextDay}
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), TOUCH_SIZE)}
            >
                <ChevronRightIcon className="rtl:rotate-180" />
            </Link>
            {date === today ? (
                <span className="ms-2 text-xs text-muted-foreground">{t.common.today}</span>
            ) : (
                <Link href={dayHref(today)} scroll={false} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ms-1", TOUCH_HEIGHT)}>
                    {t.layout.backToToday}
                </Link>
            )}
        </div>
    );
}
