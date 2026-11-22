import { AlertCircleIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { BranchesFailedAlert, settledOrThrow } from "@/components/layout/branches-failed-alert";
import { CompletionNoticeProvider } from "@/components/tasks/completion-notice";
import { MissedTaskList } from "@/components/tasks/missed-task-list";
import { MyTaskList } from "@/components/tasks/my-task-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { formatMinutes, missedMinutes } from "@/lib/attendance-rows";
import { addDays, formatDay, mondayOf } from "@/lib/coverage-rows";
import { buildInstanceRows, type InstanceRow, todayDateString } from "@/lib/instance-rows";
import { machineClockOf } from "@/lib/machine-time";
import { branchFirst, monthStart, type ShiftNow, shiftNow, splitByDay, splitMissed } from "@/lib/staff-home";
import { MyShift, myShifts } from "@/lib/staff-schedule";
import { TOUCH_HEIGHT } from "@/lib/touch";
import { cn } from "@/lib/utils";
import { Role } from "@/types/role";
import { ScheduleVsActualRow } from "@/types/schedule-vs-actual";
import { BranchScheduleView } from "@/types/shift";
import type { TaskInstanceListView } from "@/types/task-instance";

/** A staff-facing text link, tall enough to tap on a phone (DESIGN.md: 44px on touch screens). */
const staffLinkClass = cn("inline-flex items-center text-sm text-primary underline-offset-4 hover:underline", TOUCH_HEIGHT);

const hours = (shift: MyShift) => (
    <bdi dir="ltr" className="font-mono tabular-nums">
        {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
    </bdi>
);

/** Which register and (with two branches) where; each name isolated, since managers type them. */
function placeOf(shift: MyShift, showBranch: boolean): React.ReactNode {
    const parts = [shift.registerName, showBranch ? shift.branchName : null].filter((part) => part !== null);
    if (parts.length === 0) return null;
    return parts.map((part, index) => (
        <span key={index}>
            {index > 0 ? " · " : null}
            <bdi>{part}</bdi>
        </span>
    ));
}

/** A period name is typed by a manager; shifts on custom hours have none. */
const periodOf = (shift: MyShift, t: Dictionary) =>
    shift.periodName === null ? t.dashboard.customHours : <bdi>{shift.periodName}</bdi>;

function nowStatus(now: Exclude<ShiftNow, { kind: "none" }>, t: Dictionary, locale: Locale): string {
    if (now.kind === "on") return t.dashboard.onShift(formatMinutes(now.minutesLeft, locale));
    if (now.kind === "later") return t.dashboard.startsAt(now.shift.startTime.slice(0, 5));
    return t.dashboard.doneForToday;
}

/**
 * The first thing on a staff member's Home: where today's shift stands right now — on it and how long
 * is left, when it starts, or done — then which shift it is and where. A second shift today follows on
 * one line. Worked out when the page loads; reopening Home refreshes it.
 */
function NowBlock({ now, today, showBranch, t, locale }: { now: ShiftNow; today: string; showBranch: boolean; t: Dictionary; locale: Locale }) {
    return (
        <section aria-labelledby="now" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
                <h2 id="now" className="text-base font-semibold">
                    {t.common.today} <span className="font-normal text-muted-foreground">· {formatDay(today, locale)}</span>
                </h2>
                <Link href={`/schedule?week=${mondayOf(today)}`} className={staffLinkClass}>
                    {t.dashboard.schedule}
                </Link>
            </div>
            {now.kind === "none" ? (
                <p className="text-sm text-muted-foreground">{t.dashboard.noShiftToday}</p>
            ) : (
                <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                        {/* the one status mark: on shift right now */}
                        {now.kind === "on" ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-success" /> : null}
                        <span className={now.kind === "done" ? "text-muted-foreground" : undefined}>{nowStatus(now, t, locale)}</span>
                    </p>
                    <div className="flex items-baseline justify-between gap-4">
                        <p className="text-lg font-semibold">{periodOf(now.shift, t)}</p>
                        <span className="shrink-0 text-base">{hours(now.shift)}</span>
                    </div>
                    {placeOf(now.shift, showBranch) !== null ? <p className="text-sm text-muted-foreground">{placeOf(now.shift, showBranch)}</p> : null}
                    {now.kind !== "done" && now.next !== null ? (
                        <p className="text-sm text-muted-foreground">
                            {t.dashboard.then} {hours(now.next)}
                            {placeOf(now.next, showBranch) !== null ? <> · {placeOf(now.next, showBranch)}</> : null}
                        </p>
                    ) : null}
                </div>
            )}
        </section>
    );
}

/** Today's doable tasks, the branch being worked at first; with two branches, each under its own label. */
function TodayTasks({ rows, focusBranch, showBranch, t }: { rows: InstanceRow[]; focusBranch: string | null; showBranch: boolean; t: Dictionary }) {
    if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t.dashboard.nothingDueToday}</p>;

    const ordered = branchFirst(rows, focusBranch);
    const branches = [...new Set(ordered.map((row) => row.branchName))];
    if (!showBranch || branches.length === 1) return <MyTaskList rows={ordered} twoUp />;

    return (
        <div className="flex flex-col gap-5">
            {branches.map((branch) => (
                <div key={branch} className="flex flex-col gap-1.5">
                    <h3 className="text-xs font-medium text-muted-foreground ltr:tracking-[0.02em]">{t.dashboard.atBranch(branch)}</h3>
                    <MyTaskList rows={ordered.filter((row) => row.branchName === branch)} twoUp />
                </div>
            ))}
        </div>
    );
}

/** A quiet row that opens another page: a label, one line of what's there, and a chevron. */
function QuietLink({ href, label, detail }: { href: string; label: string; detail: React.ReactNode }) {
    return (
        <li>
            <Link href={href} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="truncate text-sm text-muted-foreground">{detail}</span>
                </span>
                <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
            </Link>
        </li>
    );
}

/**
 * A staff member's Home is about right now: today's shift and the tasks due on it, the branch they're
 * working at first. A recurring task's missed days sit under them as one quiet line each. Tomorrow and
 * the month's missed time are single rows that open their own pages; My tasks has the full list.
 * Every read fires together; the schedule is read per branch and week (on a Sunday, next week's too,
 * for tomorrow) and settled, so one branch failing doesn't hide the rest.
 */
export async function StaffToday({ userId, branchIds }: { userId: number; branchIds: number[] }) {
    const { t, locale } = await getI18n();

    if (branchIds.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{t.dashboard.noBranchYet}</EmptyTitle>
                    <EmptyDescription>{t.dashboard.noBranchYetDescription}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const today = todayDateString();
    const tomorrow = addDays(today, 1);
    const weeks = [...new Set([mondayOf(today), mondayOf(tomorrow)])];

    let schedules: BranchScheduleView[][];
    let failed: number;
    let pending: TaskInstanceListView[];
    let roles: Role[];
    let report: ScheduleVsActualRow[];

    try {
        const [scheduleResults, reads] = await Promise.all([
            // settled per branch, so the alert counts branches, not reads
            Promise.allSettled(
                branchIds.map((branchId) =>
                    Promise.all(
                        weeks.map((week) => fetchApi<BranchScheduleView>(`/api/branches/${branchId}/schedule?week_start=${week}`)),
                    ),
                ),
            ),
            Promise.all([
                // overdue tasks are still due: a one-off stays doable, a recurring task's become missed days
                fetchApi<TaskInstanceListView[]>(`/api/users/${userId}/tasks?status=pending&due_to=${tomorrow}`),
                fetchApi<Role[]>("/api/roles"),
                fetchApi<ScheduleVsActualRow[]>(`/api/users/${userId}/schedule-vs-actual?from=${monthStart(today)}&to=${today}`),
            ]),
        ]);
        [pending, roles, report] = reads;
        // inside the try: when every branch fails, its error gets the same alert as the reads above
        ({ values: schedules, failed } = settledOrThrow(scheduleResults));
    } catch (error) {
        // the session outlives an account removed or locked within the token's 10 minutes
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
            return (
                <Alert variant="destructive" className="max-w-2xl">
                    <AlertCircleIcon />
                    <AlertDescription>{t.dashboard.homeFailed}</AlertDescription>
                </Alert>
            );
        }
        throw error;
    }

    const shifts = splitByDay(
        myShifts(schedules.flat(), userId).filter((shift) => shift.date >= today && shift.date <= tomorrow),
        (shift) => shift.date,
        today,
    );
    const now = shiftNow(shifts.today, machineClockOf(new Date()));
    const { doable, missed } = splitMissed(buildInstanceRows(pending, roles, userId, t.tasks), today);
    const tasks = splitByDay(doable, (row) => row.dueDate, today);
    const showBranch = branchIds.length > 1;
    const minutesMissed = missedMinutes(report);
    const tomorrowShift = shifts.tomorrow[0];

    // a phone reads top to bottom; a wide screen keeps today as the main column and sets the rows beside it
    return (
        <CompletionNoticeProvider>
            <div className="grid max-w-2xl gap-8 lg:max-w-7xl lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
                {failed > 0 ? (
                    <div className="lg:col-span-full">
                        <BranchesFailedAlert failed={failed} consequence={t.dashboard.shiftsMissingConsequence} />
                    </div>
                ) : null}
                <div className="@container flex min-w-0 flex-col gap-8">
                    <NowBlock now={now} today={today} showBranch={showBranch} t={t} locale={locale} />
                    <section aria-labelledby="tasks-today" className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                            <h2 id="tasks-today" className="text-base font-semibold">{t.dashboard.tasksToday}</h2>
                            <Link href="/my-tasks" className={staffLinkClass}>
                                {t.dashboard.allMyTasks}
                            </Link>
                        </div>
                        <TodayTasks rows={tasks.today} focusBranch={now.kind === "none" ? null : now.shift.branchName} showBranch={showBranch} t={t} />
                    </section>
                    {missed.length > 0 ? (
                        <section aria-labelledby="missed" className="flex flex-col gap-1.5">
                            <h2 id="missed" className="text-xs font-medium text-muted-foreground ltr:tracking-[0.02em]">{t.tasks.missed}</h2>
                            <MissedTaskList runs={missed} showBranch={showBranch} />
                        </section>
                    ) : null}
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                    <QuietLink
                        href={`/schedule?week=${mondayOf(tomorrow)}`}
                        label={`${t.common.tomorrow} · ${formatDay(tomorrow, locale)}`}
                        detail={
                            <>
                                {tomorrowShift ? <>{periodOf(tomorrowShift, t)} {hours(tomorrowShift)}</> : t.dashboard.noShift}
                                {tasks.tomorrow.length > 0 ? <> · {t.dashboard.tasksDueCount(tasks.tomorrow.length)}</> : null}
                            </>
                        }
                    />
                    <QuietLink
                        href="/attendance"
                        label={t.dashboard.attendance}
                        detail={minutesMissed === 0 ? t.dashboard.noTimeMissedThisMonth : t.dashboard.missedThisMonth(formatMinutes(minutesMissed, locale))}
                    />
                </ul>
            </div>
        </CompletionNoticeProvider>
    );
}
