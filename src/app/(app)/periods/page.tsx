import type { Metadata } from "next";
import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { PeriodTable } from "@/components/periods/period-table";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { buildPeriodRows } from "@/lib/period-rows";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { Branch } from "@/types/branch";
import { ShiftPeriodView } from "@/types/shift-period";

export const metadata: Metadata = { title: "Periods" };

export default async function PeriodsPage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string }>;
}) {
    const [{ branch }, session] = await Promise.all([searchParams, getSession()]);
    let branchId: number | undefined;
    let branches: Branch[];
    let periodsByBranch: ShiftPeriodView[][];

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
        branchId = await getSelectedBranchId(branch, branches);
        const shown = branchId !== undefined ? branches.filter((b) => b.branchId === branchId) : branches;
        // inactive ones too: this page is where they get turned back on
        periodsByBranch = await Promise.all(
            shown.map((b) => fetchApi<ShiftPeriodView[]>(`/api/periods?branchId=${b.branchId}&includeInactive=true`)),
        );
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Periods" message="You don't have access to view periods." />;
        }
        throw error;
    }

    const rows = buildPeriodRows(periodsByBranch, branches, session?.role === OWNER_ROLE);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Periods</h1>
                <Link href="/periods/new" className={buttonVariants({ size: "sm" })}>
                    Add period
                </Link>
            </div>
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No periods yet</EmptyTitle>
                        <EmptyDescription>
                            Periods are the named times shifts are scheduled in, like Morning or Evening.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <PeriodTable rows={rows} />
            )}
        </div>
    );
}
