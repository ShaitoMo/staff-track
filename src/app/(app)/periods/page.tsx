import type { Metadata } from "next";
import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { PeriodTable } from "@/components/periods/period-table";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { buildPeriodRows } from "@/lib/period-rows";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { Branch } from "@/types/branch";
import { ShiftPeriodView } from "@/types/shift-period";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).periods.title };
}

export default async function PeriodsPage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string }>;
}) {
    const [{ branch }, session, t] = await Promise.all([searchParams, getSession(), getDictionary()]);
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
            return <AccessMessage title={t.periods.title} message={t.periods.noAccess} />;
        }
        throw error;
    }

    const rows = buildPeriodRows(periodsByBranch, branches, session?.role === OWNER_ROLE, t.periods.allBranches);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">{t.periods.title}</h1>
                <Link href="/periods/new" className={buttonVariants({ size: "sm" })}>
                    {t.periods.addPeriod}
                </Link>
            </div>
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t.periods.noneYet}</EmptyTitle>
                        <EmptyDescription>{t.periods.noneYetDescription}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <PeriodTable rows={rows} />
            )}
        </div>
    );
}
