import { CompletionNoticeProvider } from "@/components/tasks/completion-notice";
import { MyTaskList } from "@/components/tasks/my-task-list";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { addDays } from "@/lib/coverage-rows";
import { buildInstanceRows, daysAgoDateString, todayDateString } from "@/lib/instance-rows";
import { collapseOverdue, type StaffTaskRow } from "@/lib/staff-home";
import { Role } from "@/types/role";
import type { TaskInstanceListView } from "@/types/task-instance";

const RECENT_DAYS = 7;

function TaskGroup({ title, rows }: { title: string; rows: StaffTaskRow[] }) {
    if (rows.length === 0) return null;
    return (
        <section className="@container flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
            {/* two-up once wide enough, as on Home, so cards don't stretch across a desktop */}
            <MyTaskList rows={rows} className="@3xl:grid @3xl:grid-cols-2" />
        </section>
    );
}

/**
 * A staff member's task list: what's overdue, today's and tomorrow's work, and how the last week's
 * work turned out. It stops at tomorrow, like Home: a recurring task is generated two weeks ahead,
 * and those copies aren't work to do yet.
 */
export async function StaffTaskList({ userId }: { userId: number }) {
    const today = todayDateString();
    const tomorrow = addDays(today, 1);
    // "recently done" goes by when the work was finished, so a late task completed today still shows
    const [pending, recent, roles, t] = await Promise.all([
        fetchApi<TaskInstanceListView[]>(`/api/users/${userId}/tasks?status=pending&due_to=${tomorrow}`),
        fetchApi<TaskInstanceListView[]>(`/api/users/${userId}/tasks?completed_from=${daysAgoDateString(RECENT_DAYS)}`),
        fetchApi<Role[]>("/api/roles"),
        getDictionary(),
    ]);

    const pendingRows = collapseOverdue(buildInstanceRows(pending, roles, userId, t.tasks), today);

    // buildInstanceRows sorts by branch then title; re-sort to the newest-first order this list wants
    const doneRows = buildInstanceRows(recent, roles, userId, t.tasks)
        .toSorted((a, b) => (b.completedDate ?? "").localeCompare(a.completedDate ?? ""));

    return (
        <CompletionNoticeProvider>
            <div className="flex max-w-2xl flex-col gap-8 lg:max-w-5xl">
                {pendingRows.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>{t.tasks.noTasksNow}</EmptyTitle>
                            <EmptyDescription>{t.tasks.noTasksNowDescription}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <TaskGroup title={t.tasks.overdue} rows={pendingRows.filter((row) => row.dueDate < today)} />
                        <TaskGroup title={t.common.today} rows={pendingRows.filter((row) => row.dueDate === today)} />
                        <TaskGroup title={t.common.tomorrow} rows={pendingRows.filter((row) => row.dueDate > today)} />
                    </>
                )}

                {doneRows.length > 0 ? (
                    <section className="@container flex flex-col gap-2">
                        <h2 className="text-sm font-medium text-muted-foreground">{t.tasks.recentlyDone}</h2>
                        <MyTaskList rows={doneRows} className="@3xl:grid @3xl:grid-cols-2" />
                    </section>
                ) : null}
            </div>
        </CompletionNoticeProvider>
    );
}
