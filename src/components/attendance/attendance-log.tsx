"use client";

import { useState } from "react";
import { AddPunchDialog } from "@/components/attendance/add-punch-dialog";
import { StatusBadge, StatusSummary } from "@/components/attendance/attendance-status";
import { FixPunchDialog } from "@/components/attendance/fix-punch-dialog";
import { ShiftList } from "@/components/attendance/shift-list";
import { TodayMark } from "@/components/layout/today-mark";
import { buttonVariants } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n/client";
import { isolate } from "@/i18n/locales";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AttendanceRow, groupByDay, needsAction, summarizeStatuses } from "@/lib/attendance-rows";
import { formatDay } from "@/lib/coverage-rows";
import { CHOSEN } from "@/lib/selection";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";

type Filter = "needs" | "all";

/**
 * A branch's day or week as a log a manager works through: it opens on the shifts that need them
 * (a missing punch, a no-show) whenever there are any, with every shift one press away. Each of
 * those rows carries the action that settles it, so nothing has to be looked up and retyped. A week
 * is `grouped` under a heading per day, so the date is read once instead of on every row.
 */
export function AttendanceLog({
    rows,
    today,
    range,
    grouped,
    branchId,
    staff,
    defaultDate,
}: {
    rows: AttendanceRow[];
    today: string;
    /** 'Sat 24 Oct' or '5 Oct – 11 Oct', for the table caption. */
    range: string;
    grouped: boolean;
    branchId: number;
    staff: { userId: number; name: string }[];
    defaultDate: string;
}) {
    const t = useT();
    const locale = useLocale();
    const needing = rows.filter(needsAction);
    const [filter, setFilter] = useState<Filter>(needing.length > 0 ? "needs" : "all");
    // once the last one is fixed there is nothing left to filter to
    const shown = filter === "needs" && needing.length > 0 ? needing : rows;
    const active: Filter = shown === rows ? "all" : "needs";
    // a day shows as one group with no heading of its own; DayNav already names it
    const days = grouped ? groupByDay(shown) : [{ date: "", rows: shown }];

    const action = (row: AttendanceRow) => {
        // each name isolated on its own, so an English name doesn't flip the Arabic date beside it
        const where = `${isolate(row.name)}${t.common.listSeparator}${formatDay(row.shiftDate, locale)}`;

        if (row.fix !== null) {
            return (
                <FixPunchDialog
                    attendanceId={row.fix.attendanceId}
                    end={row.fix.end}
                    name={row.name}
                    shiftDate={row.shiftDate}
                    scheduledStart={row.scheduledStart}
                />
            );
        }

        // someone switched off since can't be given a punch from here
        if (row.status === "no_show" && staff.some((member) => member.userId === row.userId)) {
            return (
                <AddPunchDialog
                    branchId={branchId}
                    staff={staff}
                    defaultDate={defaultDate}
                    preset={{ userId: row.userId, date: row.shiftDate, clockIn: row.scheduledStart, label: t.attendance.addPunchFor(where) }}
                />
            );
        }

        return null;
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {needing.length > 0 ? (
                    <div role="group" aria-label={t.attendance.show} className="flex items-center gap-1">
                        {(
                            [
                                ["needs", t.attendance.needsAction(needing.length)],
                                ["all", t.attendance.allShifts(rows.length)],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={active === value}
                                onClick={() => setFilter(value)}
                                className={cn(buttonVariants({ variant: "outline", size: "sm" }), TOUCH_HEIGHT, active === value && CHOSEN)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                ) : null}
                <StatusSummary counts={summarizeStatuses(rows)} />
            </div>

            {/* phones: a stacked list per day, so the status never sits behind a sideways scroll */}
            <div className="flex flex-col gap-4 md:hidden">
                {days.map((day) => (
                    <section key={day.date} aria-label={grouped ? formatDay(day.date, locale) : range} className="flex flex-col gap-2">
                        {grouped ? <DayHeading date={day.date} today={today} /> : null}
                        <ShiftList
                            rows={day.rows}
                            lead={(row) => row.name}
                            extra={(row) => {
                                const rowAction = action(row);
                                return rowAction === null ? null : <div>{rowAction}</div>;
                            }}
                        />
                    </section>
                ))}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
                <Table>
                    <TableCaption className="sr-only">
                        {active === "needs" ? t.attendance.captionNeeds(range) : t.attendance.captionAll(range)}
                    </TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead scope="col">{t.attendance.person}</TableHead>
                            <TableHead scope="col">{t.attendance.scheduled}</TableHead>
                            <TableHead scope="col">{t.attendance.in}</TableHead>
                            <TableHead scope="col">{t.attendance.out}</TableHead>
                            <TableHead scope="col">{t.attendance.statusHeading}</TableHead>
                        </TableRow>
                    </TableHeader>
                    {days.map((day) => (
                        // one body per day, opened by its heading, as the schedule groups its periods
                        <TableBody key={day.date} className="border-t border-border first-of-type:border-t-0">
                            {grouped ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableHead scope="colgroup" colSpan={5} className="h-10 pt-4 font-semibold text-foreground">
                                        <DayHeading date={day.date} today={today} />
                                    </TableHead>
                                </TableRow>
                            ) : null}
                            {day.rows.map((row) => (
                                <TableRow key={row.shiftId}>
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell className="font-mono tabular-nums"><bdi dir="ltr">{row.scheduled}</bdi></TableCell>
                                    <TableCell className="font-mono tabular-nums">{row.clockIn ?? "—"}</TableCell>
                                    <TableCell className="font-mono tabular-nums">{row.clockOut ?? "—"}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <StatusBadge status={row.status} detail={row.detail} />
                                            {action(row)}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    ))}
                </Table>
            </div>
        </div>
    );
}

/** A week's day heading: the date, marked when it is today. */
function DayHeading({ date, today }: { date: string; today: string }) {
    const locale = useLocale();

    return (
        <span className="flex items-center gap-2 text-sm font-semibold">
            {formatDay(date, locale)}
            {date === today ? <TodayMark /> : null}
        </span>
    );
}
