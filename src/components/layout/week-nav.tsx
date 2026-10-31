import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { addDays, formatWeekRange } from "@/lib/coverage-rows";
import { TOUCH_HEIGHT, TOUCH_SIZE } from "@/lib/touch";
import { cn } from "@/lib/utils";

/**
 * ‹ 28 Sep – 4 Oct ›, plus a way back to the current week. Links keep the page's other params
 * (`query`, e.g. branch) and set `week`. `Heading` lets the range sit at the right outline level.
 */
export async function WeekNav({
    basePath,
    weekStart,
    thisWeek,
    query,
    heading: Heading = "h2",
}: {
    basePath: string;
    weekStart: string;
    thisWeek: string;
    query: Record<string, string>;
    heading?: "h2" | "h3";
}) {
    const { t, locale } = await getI18n();
    const weekHref = (week: string) => `${basePath}?${new URLSearchParams({ ...query, week })}`;

    return (
        <div className="flex items-center gap-1">
            <Link
                href={weekHref(addDays(weekStart, -7))}
                scroll={false}
                aria-label={t.layout.previousWeek}
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), TOUCH_SIZE)}
            >
                <ChevronLeftIcon className="rtl:rotate-180" />
            </Link>
            <Heading className="min-w-32 px-1 text-center text-sm font-medium tabular-nums">{formatWeekRange(weekStart, locale)}</Heading>
            <Link
                href={weekHref(addDays(weekStart, 7))}
                scroll={false}
                aria-label={t.layout.nextWeek}
                className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), TOUCH_SIZE)}
            >
                <ChevronRightIcon className="rtl:rotate-180" />
            </Link>
            {weekStart === thisWeek ? (
                <span className="ms-2 text-xs text-muted-foreground">{t.layout.thisWeek}</span>
            ) : (
                <Link
                    href={weekHref(thisWeek)}
                    scroll={false}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ms-1", TOUCH_HEIGHT)}
                >
                    {t.layout.backToThisWeek}
                </Link>
            )}
        </div>
    );
}
