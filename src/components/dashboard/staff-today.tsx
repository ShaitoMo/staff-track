import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { MissedTime, staffLinkClass } from "@/components/attendance/missed-time";
import { BranchesFailedAlert, settledOrThrow } from "@/components/layout/branches-failed-alert";
import { MyTaskList } from "@/components/tasks/my-task-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { missedMinutes } from "@/lib/attendance-rows";
import { addDays, formatDay, mondayOf } from "@/lib/coverage-rows";
import { buildInstanceRows, InstanceRow, todayDateString } from "@/lib/instance-rows";
import { MyShift, myShifts } from "@/lib/staff-schedule";
import { monthStart, splitByDay } from "@/lib/staff-home";
import { Role } from "@/types/role";
import { ScheduleVsActualRow } from "@/types/schedule-vs-actual";
import { BranchScheduleView } from "@/types/shift";
import type { TaskInstanceListView } from "@/types/task-instance";

function ShiftList({ shifts, showBranch, t }: { shifts: MyShift[]; showBranch: boolean; t: Dictionary }) {
    return (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {shifts.map((shift) => {
                const details = [shift.registerName, showBranch ? shift.branchName : null].filter((detail) => detail !== null);
                return (
                    <li key={shift.shiftId} className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium">{shift.periodName ?? t.dashboard.customHours}</p>
                            {details.length > 0 ? <p className="truncate text-xs text-muted-foreground">{details.join(" · ")}</p> : null}
                        </div>
                        <span className="shrink-0 font-mono text-sm tabular-nums">
                            <bdi dir="ltr">{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</bdi>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * A label tied to the content right under it; a link, when there is one, shares the label's row.
 * With nothing to list, the empty note takes that row too instead of a line of its own.
 */
function DayGroup({
    title,
    empty,
    link,
    children,
}: {
    title: string;
    empty?: string;
    link?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                    <h3 className="text-xs font-medium ltr:tracking-[0.02em] text-muted-foreground">{title}</h3>
                    {empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
                </div>
                {link}
            </div>
            {empty ? null : children}
        </div>
    );
}

/** One day's shifts, then that day's tasks — what a staff member checks before and on shift. */
function DayBlock({
    id,
    label,
    date,
    shifts,
    tasks,
    showBranch,
    tasksLink,
    t,
    locale,
}: {
    id: string;
    label: string;
    date: string;
    shifts: MyShift[];
    tasks: InstanceRow[];
    showBranch: boolean;
    tasksLink?: React.ReactNode;
    t: Dictionary;
    locale: Locale;
}) {
    return (
        <section aria-labelledby={id} className="@container flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 border-b border-border">
                <h2 id={id} className="text-base font-semibold">
                    {label} <span className="font-normal text-muted-foreground">· {formatDay(date, locale)}</span>
                </h2>
                <Link href={`/schedule?week=${mondayOf(date)}`} aria-label={t.dashboard.daySchedule(label)} className={staffLinkClass}>
                    {t.dashboard.schedule}
                </Link>
            </div>
            {shifts.length === 0 && tasks.length === 0 ? (
                // a free day says so once, rather than two labelled blanks
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{t.dashboard.freeDay}</p>
                    {tasksLink}
                </div>
            ) : (
                <>
                    <DayGroup title={t.dashboard.shift} empty={shifts.length === 0 ? t.dashboard.noShift : undefined}>
                        <ShiftList shifts={shifts} showBranch={showBranch} t={t} />
                    </DayGroup>
                    <DayGroup title={t.dashboard.tasksDue} empty={tasks.length === 0 ? t.dashboard.noTasksDue : undefined} link={tasksLink}>
                        {/* two-up once the column is wide enough, so cards don't stretch across a desktop */}
                        <MyTaskList rows={tasks} className="@3xl:grid @3xl:grid-cols-2" />
                    </DayGroup>
                </>
            )}
        </section>
    );
}

/**
 * A staff member's home: today and tomorrow — their shifts and the tasks due — then the time missed
 * this month. Every read fires together. The schedule is read per branch and week (on a Sunday,
 * next week's too, for tomorrow) and settled, so one branch failing doesn't hide the rest.
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
                // overdue tasks are still due, so they come along and land under Today
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
    const tasks = splitByDay(
        buildInstanceRows(pending, roles, userId, t.tasks).toSorted((a, b) => a.dueDate.localeCompare(b.dueDate)),
        (row) => row.dueDate,
        today,
    );
    const showBranch = branchIds.length > 1;

    // a phone reads top to bottom; a wide screen keeps today as the main column and sets the rest beside it
    return (
        <div className="grid max-w-2xl gap-10 lg:max-w-7xl lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
            {failed > 0 ? (
                <div className="lg:col-span-full">
                    <BranchesFailedAlert failed={failed} consequence={t.dashboard.shiftsMissingConsequence} />
                </div>
            ) : null}
            <DayBlock
                id="today"
                label={t.common.today}
                t={t}
                locale={locale}
                date={today}
                shifts={shifts.today}
                tasks={tasks.today}
                showBranch={showBranch}
                // on the list it extends, which is where overdue tasks land too
                tasksLink={
                    <Link href="/my-tasks" className={staffLinkClass}>
                        {t.dashboard.allMyTasks}
                    </Link>
                }
            />
            <div className="flex flex-col gap-10">
                <DayBlock id="tomorrow" label={t.common.tomorrow} t={t} locale={locale} date={tomorrow} shifts={shifts.tomorrow} tasks={tasks.tomorrow} showBranch={showBranch} />
                <MissedTime
                    title={t.dashboard.missedThisMonth}
                    minutes={missedMinutes(report)}
                    pending={report.filter((row) => row.incomplete_attendance_id !== null).length}
                    link={{ href: "/attendance", label: t.dashboard.attendance }}
                    className="rounded-lg border border-border bg-card p-4"
                />
            </div>
        </div>
    );
}
