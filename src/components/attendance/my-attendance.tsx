import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { StatusBadge, StatusSummary } from "@/components/attendance/attendance-status";
import { MissedTime } from "@/components/attendance/missed-time";
import { TodayMark } from "@/components/layout/today-mark";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import {
    AttendanceRow,
    buildAttendanceRows,
    missedMinutes,
    summarizeStatuses,
} from "@/lib/attendance-rows";
import { addDays, formatDay, formatWeekRange, mondayOf } from "@/lib/coverage-rows";
import { todayDateString } from "@/lib/instance-rows";
import { cn } from "@/lib/utils";
import { ScheduleVsActualRow } from "@/types/schedule-vs-actual";

/** Tensed to the week: a past week had no shifts, a future one has none yet. */
function emptyWeekMessage(weekStart: string, thisWeek: string, range: string): string {
    if (weekStart === thisWeek) return "You have no shifts this week.";
    return weekStart < thisWeek ? `You had no shifts ${range}.` : `You have no shifts ${range} yet.`;
}

/** What a shift with a missing punch needs, and what it means until then. */
function FixNote({ fix }: { fix: NonNullable<AttendanceRow["fix"]> }) {
    return (
        <p className="text-xs text-muted-foreground">
            Ask your branch manager to add your {fix.end === "clock_in" ? "clock-in" : "clock-out"}. Until then this shift
            isn&apos;t counted in your missed time.
        </p>
    );
}

/** 'In 08:45 · Out 16:00', or just the scheduled hours when nothing was clocked yet. */
function Times({ row }: { row: AttendanceRow }) {
    if (row.clockIn === null && row.clockOut === null) {
        return (
            <p className="text-sm text-muted-foreground">
                Scheduled <span className="font-mono tabular-nums">{row.scheduled}</span>
            </p>
        );
    }

    return (
        <p className="text-sm">
            In <span className="font-mono tabular-nums">{row.clockIn ?? "—"}</span>
            {" · "}Out <span className="font-mono tabular-nums">{row.clockOut ?? "—"}</span>
            <span className="text-xs text-muted-foreground">
                {" "}
                · scheduled <span className="font-mono tabular-nums">{row.scheduled}</span>
            </span>
        </p>
    );
}

/** Phones: one stacked row per shift, so the status never sits off-screen. */
function ShiftList({ rows, today }: { rows: AttendanceRow[]; today: string }) {
    return (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card md:hidden">
            {rows.map((row) => (
                <li key={row.shiftId} className={cn("flex flex-col gap-1.5 px-4 py-3", row.shiftDate === today && "bg-muted")}>
                    <div className="flex items-start justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-medium">
                            {formatDay(row.shiftDate)}
                            {row.shiftDate === today ? <TodayMark /> : null}
                        </span>
                        <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right">
                            <StatusBadge status={row.status} detail={row.detail} />
                        </span>
                    </div>
                    <Times row={row} />
                    {row.fix !== null ? <FixNote fix={row.fix} /> : null}
                </li>
            ))}
        </ul>
    );
}

/** Wider screens: the same rows as a table, scheduled and clocked times side by side. */
function ShiftTable({ rows, today, range }: { rows: AttendanceRow[]; today: string; range: string }) {
    return (
        <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
            <Table>
                <TableCaption className="sr-only">Your shifts, {range}</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead scope="col">Day</TableHead>
                        <TableHead scope="col">Scheduled</TableHead>
                        <TableHead scope="col">In</TableHead>
                        <TableHead scope="col">Out</TableHead>
                        <TableHead scope="col">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.shiftId} className={cn(row.shiftDate === today && "bg-muted")}>
                            <TableCell>
                                <span className="flex items-center gap-2">
                                    {formatDay(row.shiftDate)}
                                    {row.shiftDate === today ? <TodayMark /> : null}
                                </span>
                            </TableCell>
                            <TableCell className="font-mono tabular-nums">{row.scheduled}</TableCell>
                            <TableCell className="font-mono tabular-nums">{row.clockIn ?? "—"}</TableCell>
                            <TableCell className="font-mono tabular-nums">{row.clockOut ?? "—"}</TableCell>
                            <TableCell className="whitespace-normal">
                                <div className="flex flex-col items-start gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <StatusBadge status={row.status} detail={row.detail} />
                                    </div>
                                    {row.fix !== null ? <FixNote fix={row.fix} /> : null}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

/**
 * A staff member's own week: what they missed, then each of their shifts against what the clock
 * recorded (FR6). Read-only — a punch missing an end is fixed by a manager, so the row says who.
 */
export async function MyAttendance({ userId, weekStart }: { userId: number; weekStart: string }) {
    let report: ScheduleVsActualRow[];

    try {
        report = await fetchApi<ScheduleVsActualRow[]>(
            `/api/users/${userId}/schedule-vs-actual?from=${weekStart}&to=${addDays(weekStart, 6)}`,
        );
    } catch (error) {
        // the session outlives an account removed or locked within the token's 10 minutes
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
            return (
                <Alert variant="destructive" className="max-w-3xl">
                    <AlertCircleIcon />
                    <AlertDescription>Your attendance couldn&apos;t be loaded for this account. Sign out and back in.</AlertDescription>
                </Alert>
            );
        }
        throw error;
    }
    // every row is the viewer's own, so no names to join
    const rows = buildAttendanceRows(report, []);
    const today = todayDateString();
    const range = formatWeekRange(weekStart);

    if (rows.length === 0) {
        return (
            <p className="max-w-3xl rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                {emptyWeekMessage(weekStart, mondayOf(today), range)}{" "}
                <Link href={`/schedule?week=${weekStart}`} className="text-primary underline-offset-4 hover:underline">
                    See the schedule
                </Link>
            </p>
        );
    }

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <MissedTime title="Missed time" minutes={missedMinutes(report)} pending={rows.filter((row) => row.fix !== null).length} />
            <section aria-labelledby="my-shifts" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id="my-shifts" className="text-base font-medium">
                        Your shifts
                    </h2>
                    <StatusSummary counts={summarizeStatuses(rows)} />
                </div>
                <ShiftList rows={rows} today={today} />
                <ShiftTable rows={rows} today={today} range={range} />
            </section>
        </div>
    );
}
