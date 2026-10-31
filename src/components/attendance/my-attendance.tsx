import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { StatusBadge, StatusSummary } from "@/components/attendance/attendance-status";
import { MissedTime } from "@/components/attendance/missed-time";
import { ShiftList } from "@/components/attendance/shift-list";
import { TodayMark } from "@/components/layout/today-mark";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import {
    AttendanceRow,
    buildAttendanceRows,
    formatLatestPunch,
    missedMinutes,
    summarizeStatuses,
} from "@/lib/attendance-rows";
import { addDays, formatDay, formatWeekRange, mondayOf } from "@/lib/coverage-rows";
import { todayDateString } from "@/lib/instance-rows";
import { cn } from "@/lib/utils";
import { AttendanceFreshnessView } from "@/types/attendance";
import { ScheduleVsActualRow } from "@/types/schedule-vs-actual";

/** Tensed to the week: a past week had no shifts, a future one has none yet. */
function emptyWeekMessage(weekStart: string, thisWeek: string, range: string, t: Dictionary): string {
    if (weekStart === thisWeek) return t.attendance.noShiftsThisWeek;
    return weekStart < thisWeek ? t.attendance.hadNoShifts(range) : t.attendance.noShiftsYet(range);
}

/** What a shift still needs from the branch manager, and what it means until then; null when nothing. */
function RowNote({ row, t }: { row: AttendanceRow; t: Dictionary }) {
    let note: string | null = null;

    if (row.fix !== null) {
        note = row.fix.end === "clock_in" ? t.attendance.askForClockIn : t.attendance.askForClockOut;
    } else if (row.status === "no_show") {
        note = t.attendance.noPunchRecorded;
    }

    return note === null ? null : <p className="text-xs text-muted-foreground">{note}</p>;
}

/** Wider screens: the same rows as a table, scheduled and clocked times side by side. */
function ShiftTable({ rows, today, range, t, locale }: { rows: AttendanceRow[]; today: string; range: string; t: Dictionary; locale: Locale }) {
    return (
        <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
            <Table>
                <TableCaption className="sr-only">{t.attendance.yourShiftsCaption(range)}</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead scope="col">{t.attendance.dayHeading}</TableHead>
                        <TableHead scope="col">{t.attendance.scheduled}</TableHead>
                        <TableHead scope="col">{t.attendance.in}</TableHead>
                        <TableHead scope="col">{t.attendance.out}</TableHead>
                        <TableHead scope="col">{t.attendance.statusHeading}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.shiftId} className={cn(row.shiftDate === today && "bg-muted")}>
                            <TableCell>
                                <span className="flex items-center gap-2">
                                    {formatDay(row.shiftDate, locale)}
                                    {row.shiftDate === today ? <TodayMark /> : null}
                                </span>
                            </TableCell>
                            <TableCell className="font-mono tabular-nums"><bdi dir="ltr">{row.scheduled}</bdi></TableCell>
                            <TableCell className="font-mono tabular-nums">{row.clockIn ?? "—"}</TableCell>
                            <TableCell className="font-mono tabular-nums">{row.clockOut ?? "—"}</TableCell>
                            <TableCell className="whitespace-normal">
                                <div className="flex flex-col items-start gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <StatusBadge status={row.status} detail={row.detail} />
                                    </div>
                                    <RowNote row={row} t={t} />
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
 * Each of their branches' clock data is read alongside, so a shift the branch hasn't imported yet
 * reads as that, not as a no-show.
 */
export async function MyAttendance({ userId, branchIds, weekStart }: { userId: number; branchIds: number[]; weekStart: string }) {
    const { t, locale } = await getI18n();
    let report: ScheduleVsActualRow[];
    let freshness: (AttendanceFreshnessView | null)[];

    try {
        [report, ...freshness] = await Promise.all([
            fetchApi<ScheduleVsActualRow[]>(`/api/users/${userId}/schedule-vs-actual?from=${weekStart}&to=${addDays(weekStart, 6)}`),
            // a branch whose freshness can't be read (e.g. removed since sign-in) is just judged as before
            ...branchIds.map((branchId) =>
                fetchApi<AttendanceFreshnessView>(`/api/branches/${branchId}/attendance-freshness`).catch(() => null),
            ),
        ]);
    } catch (error) {
        // the session outlives an account removed or locked within the token's 10 minutes
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
            return (
                <Alert variant="destructive" className="max-w-3xl">
                    <AlertCircleIcon />
                    <AlertDescription>{t.attendance.myLoadFailed}</AlertDescription>
                </Alert>
            );
        }
        throw error;
    }
    const latestPunches = new Map(
        freshness
            .filter((branch) => branch !== null)
            .map((branch) => [branch.branch_id, branch.latest_punch === null ? null : new Date(branch.latest_punch)]),
    );
    // every row is the viewer's own, so no names to join
    const rows = buildAttendanceRows(report, [], { latestPunches, words: t.attendance.rows });
    const today = todayDateString();
    const range = formatWeekRange(weekStart, locale);

    if (rows.length === 0) {
        return (
            <p className="max-w-3xl rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                {emptyWeekMessage(weekStart, mondayOf(today), range, t)}{" "}
                <Link href={`/schedule?week=${weekStart}`} className="text-primary underline-offset-4 hover:underline">
                    {t.attendance.seeSchedule}
                </Link>
            </p>
        );
    }

    // the oldest of their branches' data, since that is where shifts are still waiting
    const oldest = rows
        .filter((row) => row.status === "not_imported")
        .map((row) => latestPunches.get(row.branchId) ?? null)
        .filter((latest) => latest !== null)
        .toSorted((a, b) => a.getTime() - b.getTime())[0];

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <MissedTime
                title={t.attendance.missedTime}
                minutes={missedMinutes(report)}
                pending={rows.filter((row) => row.fix !== null).length}
                noShows={rows.filter((row) => row.status === "no_show").length}
            />
            <section aria-labelledby="my-shifts" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id="my-shifts" className="text-base font-medium">
                        {t.attendance.yourShifts}
                    </h2>
                    <StatusSummary counts={summarizeStatuses(rows)} />
                </div>
                {oldest !== undefined ? (
                    <p className="text-sm text-muted-foreground">{t.attendance.punchesInThrough(formatLatestPunch(oldest, locale))}</p>
                ) : null}
                <ShiftList
                    rows={rows}
                    today={today}
                    lead={(row) => (
                        <>
                            {formatDay(row.shiftDate, locale)}
                            {row.shiftDate === today ? <TodayMark /> : null}
                        </>
                    )}
                    extra={(row) => <RowNote row={row} t={t} />}
                />
                <ShiftTable rows={rows} today={today} range={range} t={t} locale={locale} />
            </section>
        </div>
    );
}
