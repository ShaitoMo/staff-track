import { AccessMessage } from "@/components/layout/access-message";
import { BranchFilter } from "@/components/layout/branch-filter";
import { TaskCards } from "@/components/tasks/task-cards";
import { TaskRow, TaskTable } from "@/components/tasks/task-table";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { describeRecurrence } from "@/lib/recurrence-label";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { TaskWire } from "@/types/task";
import { SafeUser } from "@/types/user";

/** The task definitions (not their dated instances): streams in behind the page's Suspense boundary. */
export async function TaskDefinitions({ branchId }: { branchId?: number }) {
    let tasks: TaskWire[];
    let branches: Branch[];
    let roles: Role[];
    let users: SafeUser[];

    try {
        [tasks, branches, roles, users] = await Promise.all([
            fetchApi<TaskWire[]>("/api/tasks"),
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<Role[]>("/api/roles"),
            fetchApi<SafeUser[]>("/api/users"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Tasks" message="You don't have access to view tasks." />;
        }
        throw error;
    }

    const branchNames = new Map(branches.map((b) => [b.branchId, b.name]));
    const roleNames = new Map(roles.map((r) => [r.roleId, r.name]));
    const userNames = new Map(users.map((u) => [u.userId, u.name]));

    function assigneeName(task: TaskWire): string {
        if (task.assigned_to !== null) {
            return userNames.get(task.assigned_to) ?? `User #${task.assigned_to}`;
        }
        if (task.assigned_role_id !== null) {
            return roleNames.get(task.assigned_role_id) ?? `Role #${task.assigned_role_id}`;
        }
        return "Unassigned";
    }

    const rows: TaskRow[] = tasks
        .filter((task) => branchId === undefined || task.branch_id === branchId)
        .map((task) => ({
            taskId: task.task_id,
            title: task.title,
            branchName: branchNames.get(task.branch_id) ?? `Branch ${task.branch_id}`,
            assignee: assigneeName(task),
            schedule: describeRecurrence(task.recurrence),
            active: task.active,
        }));

    return (
        <div className="flex flex-col gap-4">
            {branches.length > 1 ? (
                <BranchFilter basePath="/tasks" branches={branches} activeBranchId={branchId} />
            ) : null}
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No tasks found</EmptyTitle>
                        <EmptyDescription>
                            {branchId !== undefined ? "This branch has no tasks yet." : "No tasks exist yet."}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    <TaskTable rows={rows} />
                    <TaskCards rows={rows} />
                </>
            )}
        </div>
    );
}
