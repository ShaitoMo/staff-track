import { StatusBadge, Times } from "@/components/attendance/attendance-status";
import { AttendanceRow } from "@/lib/attendance-rows";
import { cn } from "@/lib/utils";

/**
 * Phones: one stacked row per shift, so the status never sits off-screen behind a sideways scroll.
 * Staff lead each row with the day, a manager with the person; `extra` is what the row asks of its
 * reader (a note, or the action that fixes it).
 */
export function ShiftList({
    rows,
    today,
    lead,
    extra,
    className,
}: {
    rows: AttendanceRow[];
    /** Tints today's rows; left out where every row is the same day. */
    today?: string;
    lead: (row: AttendanceRow) => React.ReactNode;
    extra?: (row: AttendanceRow) => React.ReactNode;
    className?: string;
}) {
    return (
        <ul className={cn("divide-y divide-border rounded-lg border border-border bg-card md:hidden", className)}>
            {rows.map((row) => (
                <li key={row.shiftId} className={cn("flex flex-col gap-1.5 px-4 py-3", row.shiftDate === today && "bg-muted")}>
                    <div className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">{lead(row)}</span>
                        <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-end">
                            <StatusBadge status={row.status} detail={row.detail} />
                        </span>
                    </div>
                    <Times row={row} />
                    {extra?.(row)}
                </li>
            ))}
        </ul>
    );
}
