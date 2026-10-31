import type { Metadata } from "next";
import { AccessMessage } from "@/components/layout/access-message";
import { PeriodForm } from "@/components/periods/period-form";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { Branch } from "@/types/branch";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).periods.newTitle };
}

export default async function NewPeriodPage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string }>;
}) {
    const [{ branch }, session, t] = await Promise.all([searchParams, getSession(), getDictionary()]);
    let branches: Branch[];
    let defaultBranchId: number | undefined;

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
        defaultBranchId = await getSelectedBranchId(branch, branches);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.periods.newTitle} message={t.periods.noCreateAccess} />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.periods.newTitle}</h1>
            <PeriodForm
                mode="create"
                branches={branches}
                canPickChainWide={session?.role === OWNER_ROLE}
                defaultBranchId={defaultBranchId}
            />
        </div>
    );
}
