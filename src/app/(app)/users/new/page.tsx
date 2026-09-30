import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserForm } from "@/components/users/user-form";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";

export default async function NewUserPage() {
    let roles: Role[];
    let branches: Branch[];

    try {
        [roles, branches] = await Promise.all([
            fetchApi<Role[]>("/api/roles"),
            fetchApi<Branch[]>("/api/branches"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return (
                <div>
                    <h1 className="text-xl font-medium">New user</h1>
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircleIcon />
                        <AlertDescription>You don&apos;t have access to create users.</AlertDescription>
                    </Alert>
                </div>
            );
        }
        throw error;
    }

    const assignableRoles = roles.filter((role) => role.name !== OWNER_ROLE);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-medium">New user</h1>
            <UserForm mode="create" roles={assignableRoles} branches={branches} canEditRoleAndStatus />
        </div>
    );
}
