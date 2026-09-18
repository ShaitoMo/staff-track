import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { BranchFilter } from "@/components/users/branch-filter";
import { UserCards } from "@/components/users/user-cards";
import { UserTable } from "@/components/users/user-table";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { buildUserRows } from "@/lib/user-rows";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { SafeUser } from "@/types/user";
import { UserBranch } from "@/types/user-branch";

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string }>;
}) {
    const { branch } = await searchParams;
    const session = await getSession();
    const isOwner = session?.role === OWNER_ROLE;
    const branchId = branch && /^\d+$/.test(branch) ? Number(branch) : undefined;
    const usersPath = branchId !== undefined ? `/api/users?branch_id=${branchId}` : "/api/users";

    let users: SafeUser[];
    let roles: Role[];
    let branches: Branch[];
    let userBranches: UserBranch[];

    try {
        [users, roles, branches, userBranches] = await Promise.all([
            fetchApi<SafeUser[]>(usersPath),
            fetchApi<Role[]>("/api/roles"),
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<UserBranch[]>("/api/user-branches"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return (
                <div>
                    <h1 className="text-xl font-medium">Users</h1>
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircleIcon />
                        <AlertDescription>You don&apos;t have access to view the users list.</AlertDescription>
                    </Alert>
                </div>
            );
        }
        throw error;
    }

    const rows = buildUserRows(users, roles, branches, userBranches);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-medium">Users</h1>
            {isOwner && <BranchFilter branches={branches} activeBranchId={branchId} />}
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No users found</EmptyTitle>
                        <EmptyDescription>
                            {branchId !== undefined ? "No one is linked to this branch yet." : "No users exist yet."}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    <UserTable rows={rows} />
                    <UserCards rows={rows} />
                </>
            )}
        </div>
    );
}
