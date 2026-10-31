import { ShiftPeriodView } from "@/types/shift-period";

/**
 * A period's default hours beside its name; shared by the roster and the editing grid so both
 * headings match. Its own module so the client grid doesn't pull in the server-rendered roster.
 */
export function PeriodHours({ period }: { period: ShiftPeriodView }) {
    return (
        <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
            <bdi dir="ltr">{period.defaultStart}–{period.defaultEnd}</bdi>
        </span>
    );
}
