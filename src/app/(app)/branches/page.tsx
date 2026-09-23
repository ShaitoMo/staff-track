import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { BranchTable } from "@/components/branches/branch-table";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Branch } from "@/types/branch";

export default async function BranchesPage() {
    const session = await getSession();
    const isOwner = session?.role === OWNER_ROLE;

    let branches: Branch[];

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Branches" message="You don't have access to view branches." />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-medium">Branches</h1>
                {isOwner && (
                    <Link href="/branches/new" className={buttonVariants({ size: "sm" })}>
                        Add branch
                    </Link>
                )}
            </div>
            {branches.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No branches found</EmptyTitle>
                        <EmptyDescription>No branches exist yet.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <BranchTable branches={branches} canEdit={isOwner} />
            )}
        </div>
    );
}
