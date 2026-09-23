import { AccessMessage } from "@/components/layout/access-message";
import { UserForm } from "@/components/users/user-form";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { SafeUser } from "@/types/user";
import { UserBranch } from "@/types/user-branch";

export default async function EditUserPage({
    params,
}: {
    params: Promise<{ userId: string }>;
}) {
    const { userId: userIdParam } = await params;

    if (!/^\d+$/.test(userIdParam)) {
        return <AccessMessage title="Edit user" message="Invalid user." />;
    }
    const userId = Number(userIdParam);

    const session = await getSession();

    let targetUser: SafeUser;
    let roles: Role[];
    let branches: Branch[];
    let userBranches: UserBranch[];

    try {
        [targetUser, roles, branches, userBranches] = await Promise.all([
            fetchApi<SafeUser>(`/api/users/${userId}`),
            fetchApi<Role[]>("/api/roles"),
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<UserBranch[]>(`/api/user-branches?user_id=${userId}`),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Edit user" message="You don't have access to edit this user." />;
        }
        if (error instanceof ApiError && error.status === 404) {
            return <AccessMessage title="Edit user" message="User not found." />;
        }
        throw error;
    }

    // Excludes "owner" as an assignable choice, except to correctly display it when it's
    // already the target's current role (e.g. an owner editing their own profile).
    const assignableRoles = roles.filter((role) => role.name !== OWNER_ROLE || role.roleId === targetUser.roleId);
    const canEditRoleAndStatus = session?.role === OWNER_ROLE && session.userId !== userId;

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-medium">Edit {targetUser.name}</h1>
            <UserForm
                mode="edit"
                userId={userId}
                roles={assignableRoles}
                branches={branches}
                canEditRoleAndStatus={canEditRoleAndStatus}
                initialValues={{
                    name: targetUser.name,
                    phone: targetUser.phone,
                    roleId: targetUser.roleId,
                    isActive: targetUser.isActive,
                    branchLinks: userBranches
                        .filter((link) => link.userId === userId)
                        .map((link) => ({ branchId: link.branchId, machineEmployeeId: link.machineEmployeeId })),
                }}
            />
        </div>
    );
}
