import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { BranchFilter } from "@/components/layout/branch-filter";
import { RegisterRow, RegisterTable } from "@/components/registers/register-table";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { Branch } from "@/types/branch";
import { Register } from "@/types/register";

export default async function RegistersPage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string }>;
}) {
    const { branch } = await searchParams;
    const branchId = branch && /^\d+$/.test(branch) ? Number(branch) : undefined;

    let branches: Branch[];
    let registersByBranch: Register[][];

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
        const shown = branchId !== undefined ? branches.filter((b) => b.branchId === branchId) : branches;
        registersByBranch = await Promise.all(
            shown.map((b) => fetchApi<Register[]>(`/api/branches/${b.branchId}/registers`)),
        );
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Registers" message="You don't have access to view registers." />;
        }
        throw error;
    }

    const branchNames = new Map(branches.map((b) => [b.branchId, b.name]));
    const rows: RegisterRow[] = registersByBranch.flat().map((register) => ({
        registerId: register.registerId,
        name: register.name,
        branchName: branchNames.get(register.branchId) ?? `Branch ${register.branchId}`,
    }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-medium">Registers</h1>
                <Link href="/registers/new" className={buttonVariants({ size: "sm" })}>
                    Add register
                </Link>
            </div>
            {branches.length > 1 && <BranchFilter basePath="/registers" branches={branches} activeBranchId={branchId} />}
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No registers found</EmptyTitle>
                        <EmptyDescription>
                            {branchId !== undefined ? "This branch has no registers yet." : "No registers exist yet."}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <RegisterTable rows={rows} />
            )}
        </div>
    );
}
