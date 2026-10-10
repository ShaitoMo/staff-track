import type { Metadata } from "next";
import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { UserCards } from "@/components/users/user-cards";
import { UserTable } from "@/components/users/user-table";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { getSelectedBranchId } from "@/lib/session";
import { buildUserRows } from "@/lib/user-rows";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import { SafeUser } from "@/types/user";
import { UserBranch } from "@/types/user-branch";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string }>;
}) {
    const { branch } = await searchParams;
    let branchId: number | undefined;
    let users: SafeUser[];
    let roles: Role[];
    let branches: Branch[];
    let userBranches: UserBranch[];

    try {
        [roles, branches, userBranches] = await Promise.all([
            fetchApi<Role[]>("/api/roles"),
            fetchApi<Branch[]>("/api/branches"),
            fetchApi<UserBranch[]>("/api/user-branches"),
        ]);
        // the top bar's branch is checked against the branches the API scoped to this viewer first
        branchId = await getSelectedBranchId(branch, branches);
        users = await fetchApi<SafeUser[]>(branchId !== undefined ? `/api/users?branch_id=${branchId}` : "/api/users");
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Users" message="You don't have access to view the users list." />;
        }
        throw error;
    }

    const rows = buildUserRows(users, roles, branches, userBranches);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Users</h1>
                <Link href="/users/new" className={buttonVariants({ size: "sm" })}>
                    Add user
                </Link>
            </div>
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
