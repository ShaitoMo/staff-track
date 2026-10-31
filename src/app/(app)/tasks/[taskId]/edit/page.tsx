import type { Metadata } from "next";
import { AccessMessage } from "@/components/layout/access-message";
import { TaskForm } from "@/components/tasks/task-form";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { taskToEditableState } from "@/lib/task-form-validation";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { TaskWire } from "@/types/task";
import { SafeUser } from "@/types/user";
import { UserBranch } from "@/types/user-branch";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).tasks.editTitle };
}

export default async function EditTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
    const [{ taskId }, t] = await Promise.all([params, getDictionary()]);

    if (!/^\d+$/.test(taskId)) {
        return <AccessMessage title={t.tasks.editTitle} message={t.tasks.invalidTask} />;
    }

    let task: TaskWire;
    let branches: Branch[];
    let roles: Role[];
    let users: SafeUser[];
    let userBranches: UserBranch[];

    try {
        [task, branches, roles, users, userBranches] = await Promise.all([
            fetchApi<TaskWire>(`/api/tasks/${taskId}`),
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<Role[]>("/api/roles"),
            fetchApi<SafeUser[]>("/api/users"),
            fetchApi<UserBranch[]>("/api/user-branches"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.tasks.editTitle} message={t.tasks.noEditAccess} />;
        }
        if (error instanceof ApiError && error.status === 404) {
            return <AccessMessage title={t.tasks.editTitle} message={t.tasks.notFound} />;
        }
        throw error;
    }

    const assignableRoles = roles.filter((role) => role.name !== OWNER_ROLE);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.tasks.editTitle}</h1>
            <TaskForm
                mode="edit"
                taskId={task.task_id}
                initialValues={taskToEditableState(task)}
                branches={branches}
                roles={assignableRoles}
                users={users.map(({ userId, name, isActive }) => ({ userId, name, isActive }))}
                userBranches={userBranches.map(({ userId, branchId }) => ({ userId, branchId }))}
            />
        </div>
    );
}
