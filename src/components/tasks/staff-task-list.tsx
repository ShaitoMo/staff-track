import { AlertCircleIcon } from "lucide-react";
import { CompletionNoticeProvider } from "@/components/tasks/completion-notice";
import { MissedTaskList } from "@/components/tasks/missed-task-list";
import { MyTaskList } from "@/components/tasks/my-task-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getDictionary } from "@/i18n/server";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { addDays } from "@/lib/coverage-rows";
import { buildInstanceRows, daysAgoDateString, todayDateString } from "@/lib/instance-rows";
import { splitByDay, splitMissed } from "@/lib/staff-home";
import { Role } from "@/types/role";
import type { TaskInstanceListView } from "@/types/task-instance";

const RECENT_DAYS = 7;

function TaskGroup({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="@container flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
            {children}
        </section>
    );
}

/**
 * A staff member's full task list, where Home shows only right now: today's work (an overdue one-off
 * included), a recurring task's missed days, tomorrow's tasks to look ahead at, and how the last
 * week's work turned out. It stops at tomorrow: recurring tasks are generated two weeks ahead.
 */
export async function StaffTaskList({ userId }: { userId: number }) {
    const today = todayDateString();
    const tomorrow = addDays(today, 1);
    const t = await getDictionary();

    let pending: TaskInstanceListView[];
    let recent: TaskInstanceListView[];
    let roles: Role[];
    try {
        // "recently done" goes by when the work was finished, so a late task completed today still shows
        [pending, recent, roles] = await Promise.all([
            fetchApi<TaskInstanceListView[]>(`/api/users/${userId}/tasks?status=pending&due_to=${tomorrow}`),
            fetchApi<TaskInstanceListView[]>(`/api/users/${userId}/tasks?completed_from=${daysAgoDateString(RECENT_DAYS)}`),
            fetchApi<Role[]>("/api/roles"),
        ]);
    } catch (error) {
        // the session outlives an account removed or locked within the token's 10 minutes
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
            return (
                <Alert variant="destructive" className="max-w-2xl">
                    <AlertCircleIcon />
                    <AlertDescription>{t.tasks.myTasksFailed}</AlertDescription>
                </Alert>
            );
        }
        throw error;
    }

    const { doable, missed } = splitMissed(buildInstanceRows(pending, roles, userId, t.tasks), today);
    const { today: todays, tomorrow: tomorrows } = splitByDay(doable, (row) => row.dueDate, today);
    const showBranch = new Set(pending.map((instance) => instance.task.branch_id)).size > 1;

    // buildInstanceRows sorts by branch then title; re-sort to the newest-first order this list wants
    const doneRows = buildInstanceRows(recent, roles, userId, t.tasks)
        .toSorted((a, b) => (b.completedDate ?? "").localeCompare(a.completedDate ?? ""));

    return (
        <CompletionNoticeProvider>
            <div className="flex max-w-2xl flex-col gap-8 lg:max-w-5xl">
                {doable.length === 0 && missed.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>{t.tasks.noTasksNow}</EmptyTitle>
                            <EmptyDescription>{t.tasks.noTasksNowDescription}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <TaskGroup title={t.common.today}>
                            {todays.length > 0 ? (
                                <MyTaskList rows={todays} twoUp />
                            ) : (
                                <p className="text-sm text-muted-foreground">{t.dashboard.nothingDueToday}</p>
                            )}
                        </TaskGroup>
                        {missed.length > 0 ? (
                            <TaskGroup title={t.tasks.missed}>
                                <MissedTaskList runs={missed} showBranch={showBranch} />
                            </TaskGroup>
                        ) : null}
                        {tomorrows.length > 0 ? (
                            <TaskGroup title={t.common.tomorrow}>
                                <MyTaskList rows={tomorrows} upcoming twoUp />
                            </TaskGroup>
                        ) : null}
                    </>
                )}

                {doneRows.length > 0 ? (
                    <TaskGroup title={t.tasks.recentlyDone}>
                        <MyTaskList rows={doneRows} twoUp />
                    </TaskGroup>
                ) : null}
            </div>
        </CompletionNoticeProvider>
    );
}
