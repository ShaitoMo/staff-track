import { AccessMessage } from "@/components/layout/access-message";
import { InstanceCards } from "@/components/tasks/instance-cards";
import { InstanceTable } from "@/components/tasks/instance-table";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { buildInstanceRows } from "@/lib/instance-rows";
import { getSession } from "@/lib/session";
import { Role } from "@/types/role";
import type { TaskInstanceListView } from "@/types/task-instance";

/** Everything scoped to one day: streams in behind the page's Suspense boundary. */
export async function TaskInstances({ date, branchId }: { date: string; branchId?: number }) {
    const query = new URLSearchParams({ date });
    if (branchId !== undefined) {
        query.set("branch_id", String(branchId));
    }

    let instances: TaskInstanceListView[];
    let roles: Role[];
    let session: Awaited<ReturnType<typeof getSession>>;

    try {
        [instances, roles, session] = await Promise.all([
            fetchApi<TaskInstanceListView[]>(`/api/task-instances?${query}`),
            fetchApi<Role[]>("/api/roles"),
            getSession(),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Tasks" message="You don't have access to view task instances." />;
        }
        throw error;
    }

    // the (app) layout already turned away anyone without a session; refuse rather than offer review to no one in particular
    if (!session) {
        throw new Error("Instances view rendered without a session");
    }

    const rows = buildInstanceRows(instances, roles, session.userId);

    return (
        <div className="flex flex-col gap-4">
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No tasks due</EmptyTitle>
                        <EmptyDescription>Nothing is due on {date}.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    <InstanceTable rows={rows} />
                    <InstanceCards rows={rows} />
                </>
            )}
        </div>
    );
}
