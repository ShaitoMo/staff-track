import { AccessMessage } from "@/components/layout/access-message";
import { TaskCards } from "@/components/tasks/task-cards";
import { TaskRow, TaskTable } from "@/components/tasks/task-table";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { describeRecurrence } from "@/lib/recurrence-label";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { TaskWire } from "@/types/task";
import { SafeUser } from "@/types/user";

/** The task definitions (not their dated instances): streams in behind the page's Suspense boundary. */
export async function TaskDefinitions({ branchId }: { branchId?: number }) {
    const t = await getDictionary();
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
            return <AccessMessage title={t.tasks.title} message={t.tasks.noAccess} />;
        }
        throw error;
    }

    const branchNames = new Map(branches.map((b) => [b.branchId, b.name]));
    const roleNames = new Map(roles.map((r) => [r.roleId, r.name]));
    const userNames = new Map(users.map((u) => [u.userId, u.name]));

    function assigneeName(task: TaskWire): string {
        if (task.assigned_to !== null) {
            return userNames.get(task.assigned_to) ?? `#${task.assigned_to}`;
        }
        if (task.assigned_role_id !== null) {
            return roleNames.get(task.assigned_role_id) ?? `#${task.assigned_role_id}`;
        }
        return t.tasks.unassigned;
    }

    const rows: TaskRow[] = tasks
        .filter((task) => branchId === undefined || task.branch_id === branchId)
        .map((task) => ({
            taskId: task.task_id,
            title: task.title,
            branchName: branchNames.get(task.branch_id) ?? `#${task.branch_id}`,
            assignee: assigneeName(task),
            schedule: describeRecurrence(task.recurrence, t.tasks.recurrence),
            active: task.active,
        }));

    return (
        <div className="flex flex-col gap-4">
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t.tasks.noTasksFound}</EmptyTitle>
                        <EmptyDescription>{branchId !== undefined ? t.tasks.branchHasNoTasks : t.tasks.noTasksYet}</EmptyDescription>
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
