import type { Locale } from "@/i18n/locales";
import { formatDayMonth, formatDayStacked } from "@/lib/coverage-rows";

/**
 * A week grid's column head: the weekday over the date, since an Arabic day ('الخميس 29 تشرين الأول')
 * is too long for one line of a seventh of the week. No hooks, so the client grid and the server roster
 * both render it; `todayLabel` marks today's column where the screen wants it.
 */
export function DayHeading({ date, locale, todayLabel }: { date: string; locale: Locale; todayLabel?: string }) {
    return (
        <>
            <span className="block">
                {formatDayStacked(date, locale).weekday}
                {todayLabel ? <span className="ms-1.5 text-xs font-normal text-muted-foreground">{todayLabel}</span> : null}
            </span>
            <span className="block text-xs font-normal text-muted-foreground">{formatDayMonth(date, locale)}</span>
        </>
    );
}
