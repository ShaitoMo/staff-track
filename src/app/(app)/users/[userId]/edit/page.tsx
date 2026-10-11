import { AlertCircleIcon } from "lucide-react";
import { AccessMessage } from "@/components/layout/access-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    searchParams,
}: {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ branch_warning?: string }>;
}) {
    const [{ userId: userIdParam }, { branch_warning }] = await Promise.all([params, searchParams]);

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
            fetchApi<UserBranch[]>(`/api/user-branches?userId=${userId}`),
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

    const failedBranchNames = (branch_warning ?? "")
        .split(",")
        .map((id) => branches.find((branch) => branch.branchId === Number(id))?.name)
        .filter((name): name is string => Boolean(name));

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">Edit {targetUser.name}</h1>
            {branch_warning && (
                <Alert variant="destructive" className="max-w-lg">
                    <AlertCircleIcon />
                    <AlertDescription>
                        The user was created, but{" "}
                        {failedBranchNames.length > 0
                            ? `these branches couldn't be linked: ${failedBranchNames.join(", ")}`
                            : "some branches couldn't be linked"}
                        . Check the branches below and save again.
                    </AlertDescription>
                </Alert>
            )}
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
