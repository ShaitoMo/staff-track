import { AccessMessage } from "@/components/layout/access-message";
import { BranchFilter } from "@/components/layout/branch-filter";
import { InstanceTable } from "@/components/tasks/instance-table";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { buildInstanceRows } from "@/lib/instance-rows";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import type { TaskInstanceListView } from "@/types/task-instance";

/** Everything scoped to one day: streams in behind the page's Suspense boundary. */
export async function TaskInstances({ date, branchId }: { date: string; branchId?: number }) {
    const query = new URLSearchParams({ date });
    if (branchId !== undefined) {
        query.set("branch_id", String(branchId));
    }

    let instances: TaskInstanceListView[];
    let branches: Branch[];
    let roles: Role[];

    try {
        [instances, branches, roles] = await Promise.all([
            fetchApi<TaskInstanceListView[]>(`/api/task-instances?${query}`),
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<Role[]>("/api/roles"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Tasks" message="You don't have access to view task instances." />;
        }
        throw error;
    }

    const rows = buildInstanceRows(instances, roles);

    return (
        <div className="flex flex-col gap-4">
            {branches.length > 1 ? (
                <BranchFilter
                    basePath="/tasks"
                    branches={branches}
                    activeBranchId={branchId}
                    extraQuery={{ view: "instances", date }}
                />
            ) : null}
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No tasks due</EmptyTitle>
                        <EmptyDescription>Nothing is due on {date}.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <InstanceTable rows={rows} />
            )}
        </div>
    );
}
