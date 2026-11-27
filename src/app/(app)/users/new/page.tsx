import type { Metadata } from "next";
import { AccessMessage } from "@/components/layout/access-message";
import { UserForm } from "@/components/users/user-form";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).users.newTitle };
}

export default async function NewUserPage() {
    const [session, t] = await Promise.all([getSession(), getDictionary()]);

    // the reads below are open to a Manager, so without this they'd get a form whose save is refused
    if (session?.role !== OWNER_ROLE) {
        return <AccessMessage title={t.users.newTitle} message={t.users.noCreateAccess} />;
    }

    let roles: Role[];
    let branches: Branch[];

    try {
        [roles, branches] = await Promise.all([
            fetchApi<Role[]>("/api/roles"),
            fetchApi<Branch[]>("/api/branches"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.users.newTitle} message={t.users.noCreateAccess} />;
        }
        throw error;
    }

    const assignableRoles = roles.filter((role) => role.name !== OWNER_ROLE);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.users.newTitle}</h1>
            <UserForm mode="create" roles={assignableRoles} branches={branches} canEditRoleAndStatus />
        </div>
    );
}
