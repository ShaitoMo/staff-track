import type { Metadata } from "next";
import { AccessMessage } from "@/components/layout/access-message";
import { TaskForm } from "@/components/tasks/task-form";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { SafeUser } from "@/types/user";
import { UserBranch } from "@/types/user-branch";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage() {
    let branches: Branch[];
    let roles: Role[];
    let users: SafeUser[];
    let userBranches: UserBranch[];

    try {
        [branches, roles, users, userBranches] = await Promise.all([
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<Role[]>("/api/roles"),
            fetchApi<SafeUser[]>("/api/users"),
            fetchApi<UserBranch[]>("/api/user-branches"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="New task" message="You don't have access to create tasks." />;
        }
        throw error;
    }

    const assignableRoles = roles.filter((role) => role.name !== OWNER_ROLE);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">New task</h1>
            <TaskForm
                branches={branches}
                roles={assignableRoles}
                // only what the form uses crosses to the client: not phone numbers or machine ids
                users={users.map(({ userId, name, isActive }) => ({ userId, name, isActive }))}
                userBranches={userBranches.map(({ userId, branchId }) => ({ userId, branchId }))}
            />
        </div>
    );
}
