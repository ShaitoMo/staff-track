import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { MissedTime, staffLinkClass } from "@/components/attendance/missed-time";
import { BranchesFailedAlert, settledOrThrow } from "@/components/layout/branches-failed-alert";
import { MyTaskList } from "@/components/tasks/my-task-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
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

function ShiftList({ shifts, showBranch }: { shifts: MyShift[]; showBranch: boolean }) {
    if (shifts.length === 0) {
        return <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">No shift</p>;
    }

    return (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {shifts.map((shift) => {
                const details = [shift.registerName, showBranch ? shift.branchName : null].filter((detail) => detail !== null);
                return (
                    <li key={shift.shiftId} className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium">{shift.periodName ?? "Custom hours"}</p>
                            {details.length > 0 ? <p className="truncate text-xs text-muted-foreground">{details.join(" · ")}</p> : null}
                        </div>
                        <span className="shrink-0 font-mono text-sm tabular-nums">
                            {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
                        </span>
                    </li>
                );
            })}
        </ul>
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
}: {
    id: string;
    label: string;
    date: string;
    shifts: MyShift[];
    tasks: InstanceRow[];
    showBranch: boolean;
}) {
    return (
        <section aria-labelledby={id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h2 id={id} className="text-base font-medium">
                    {label} <span className="font-normal text-muted-foreground">· {formatDay(date)}</span>
                </h2>
                <Link href={`/schedule?week=${mondayOf(date)}`} aria-label={`${label}'s schedule`} className={staffLinkClass}>
                    Schedule
                </Link>
            </div>
            <h3 className="text-xs font-medium text-muted-foreground">Shift</h3>
            <ShiftList shifts={shifts} showBranch={showBranch} />
            <h3 className="mt-1 text-xs font-medium text-muted-foreground">Tasks due</h3>
            {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks due.</p> : <MyTaskList rows={tasks} />}
        </section>
    );
}

/**
 * A staff member's home: today and tomorrow — their shifts and the tasks due — then the time missed
 * this month. Every read fires together. The schedule is read per branch and week (on a Sunday,
 * next week's too, for tomorrow) and settled, so one branch failing doesn't hide the rest.
 */
export async function StaffToday({ userId, branchIds }: { userId: number; branchIds: number[] }) {
    if (branchIds.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>No branch yet</EmptyTitle>
                    <EmptyDescription>You&apos;ll see your shifts and tasks once a manager adds you to a branch.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const today = todayDateString();
    const tomorrow = addDays(today, 1);
    const weeks = [...new Set([mondayOf(today), mondayOf(tomorrow)])];

    let scheduleResults: PromiseSettledResult<BranchScheduleView[]>[];
    let pending: TaskInstanceListView[];
    let roles: Role[];
    let report: ScheduleVsActualRow[];

    try {
        [scheduleResults, [pending, roles, report]] = await Promise.all([
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
    } catch (error) {
        // the session outlives an account removed or locked within the token's 10 minutes
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
            return (
                <Alert variant="destructive" className="max-w-2xl">
                    <AlertCircleIcon />
                    <AlertDescription>Your home page couldn&apos;t be loaded. Reload the page; if it keeps happening, sign out and back in.</AlertDescription>
                </Alert>
            );
        }
        throw error;
    }

    const { values: schedules, failed } = settledOrThrow(scheduleResults);
    const shifts = splitByDay(
        myShifts(schedules.flat(), userId).filter((shift) => shift.date >= today && shift.date <= tomorrow),
        (shift) => shift.date,
        today,
    );
    const tasks = splitByDay(
        buildInstanceRows(pending, roles, userId).toSorted((a, b) => a.dueDate.localeCompare(b.dueDate)),
        (row) => row.dueDate,
        today,
    );
    const showBranch = branchIds.length > 1;

    return (
        <div className="flex max-w-2xl flex-col gap-8">
            <BranchesFailedAlert failed={failed} consequence="shifts there are missing below" />
            <DayBlock id="today" label="Today" date={today} shifts={shifts.today} tasks={tasks.today} showBranch={showBranch} />
            <DayBlock id="tomorrow" label="Tomorrow" date={tomorrow} shifts={shifts.tomorrow} tasks={tasks.tomorrow} showBranch={showBranch} />
            {/* right after the tasks it extends, not below the pay block */}
            <Link href="/my-tasks" className={staffLinkClass}>
                All my tasks
            </Link>
            <MissedTime
                title="Missed this month"
                minutes={missedMinutes(report)}
                pending={report.filter((row) => row.incomplete_attendance_id !== null).length}
                link={{ href: "/attendance", label: "Attendance" }}
                className="rounded-lg border border-border bg-card p-4"
            />
        </div>
    );
}
