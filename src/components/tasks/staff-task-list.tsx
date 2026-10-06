import { MyTaskList } from "@/components/tasks/my-task-list";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { fetchApi } from "@/lib/api-server";
import { buildInstanceRows, daysAgoDateString } from "@/lib/instance-rows";
import { Role } from "@/types/role";
import type { TaskInstanceListView } from "@/types/task-instance";

const RECENT_DAYS = 7;

/** A staff member's task list: what's left to do, and how the last week's work turned out. */
export async function StaffTaskList({ userId }: { userId: number }) {
    // "recently done" goes by when the work was finished, so a late task completed today still shows
    const [pending, recent, roles] = await Promise.all([
        fetchApi<TaskInstanceListView[]>(`/api/users/${userId}/tasks?status=pending`),
        fetchApi<TaskInstanceListView[]>(`/api/users/${userId}/tasks?completed_from=${daysAgoDateString(RECENT_DAYS)}`),
        fetchApi<Role[]>("/api/roles"),
    ]);

    const pendingRows = buildInstanceRows(pending, roles, userId);

    // buildInstanceRows sorts by branch then title; re-sort to the newest-first order this list wants
    const doneRows = buildInstanceRows(recent, roles, userId)
        .toSorted((a, b) => (b.completedDate ?? "").localeCompare(a.completedDate ?? ""));

    return (
        <div className="flex flex-col gap-6">
            {pendingRows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No tasks right now</EmptyTitle>
                        <EmptyDescription>Tasks assigned to you will show up here.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <MyTaskList rows={pendingRows} />
            )}

            {doneRows.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <h2 className="text-base font-medium">Recently done</h2>
                    <MyTaskList rows={doneRows} />
                </section>
            ) : null}
        </div>
    );
}
