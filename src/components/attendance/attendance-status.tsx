import { Badge } from "@/components/ui/badge";
import { AttendanceStatus, STATUS_LABELS, STATUS_ORDER } from "@/lib/attendance-rows";
import { cn } from "@/lib/utils";

// Status is functional colour, never Market Blue (DESIGN.md). Loudness follows how much a status
// asks of the reader: on time is the quietest thing on the page, a slip gets a plain outline, a
// shift still ahead (or running with nobody in yet) a dashed one, and red is kept for what needs a
// manager — a no-show, or a punch missing an end.
const STATUS_STYLES: Record<AttendanceStatus, { variant: "outline" | "destructive" | "ghost"; className?: string }> = {
    on_time: { variant: "ghost", className: "px-0 font-normal text-muted-foreground" },
    late: { variant: "outline" },
    left_early: { variant: "outline" },
    missing_clock_in: { variant: "destructive" },
    missing_clock_out: { variant: "destructive" },
    no_show: { variant: "destructive" },
    not_in_yet: { variant: "outline", className: "border-dashed font-normal text-muted-foreground" },
    upcoming: { variant: "outline", className: "border-dashed font-normal text-muted-foreground" },
};

/**
 * A late or left-early shift's badge is its slip — '12 min late · left 20 min early' — rather than
 * 'Late' followed by the same word again. Any other status keeps its name and shows the slip
 * beside it, since 'Missing clock-out' must not be hidden behind '12 min late'.
 */
export function StatusBadge({ status, detail }: { status: AttendanceStatus; detail: string | null }) {
    const { variant, className } = STATUS_STYLES[status];
    const isSlip = status === "late" || status === "left_early";

    return (
        <>
            <Badge variant={variant} className={cn("h-auto min-h-5 whitespace-normal", className)}>
                {isSlip && detail !== null ? detail : STATUS_LABELS[status]}
            </Badge>
            {!isSlip && detail !== null ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
        </>
    );
}

/** '12 on time · 3 late · 2 no-show' — statuses with no shifts are left out. */
export function StatusSummary({ counts }: { counts: Record<AttendanceStatus, number> }) {
    const parts = STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => `${counts[status]} ${STATUS_LABELS[status].toLowerCase()}`);

    return <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>;
}
