"use client";

import { useT } from "@/i18n/client";

/** Flags today's row in a week view — the schedule and attendance both use it. */
export function TodayMark() {
    const t = useT();
    return <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-xs font-medium text-background">{t.common.today}</span>;
}
