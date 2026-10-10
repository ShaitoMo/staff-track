import type { Metadata } from "next";
import { AccessMessage } from "@/components/layout/access-message";
import { PeriodForm } from "@/components/periods/period-form";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Branch } from "@/types/branch";
import { ShiftPeriodView } from "@/types/shift-period";

export const metadata: Metadata = { title: "Edit period" };

export default async function EditPeriodPage({
    params,
}: {
    params: Promise<{ periodId: string }>;
}) {
    const { periodId: periodIdParam } = await params;

    if (!/^\d+$/.test(periodIdParam)) {
        return <AccessMessage title="Edit period" message="Invalid period." />;
    }
    const periodId = Number(periodIdParam);

    let period: ShiftPeriodView;
    let branches: Branch[];

    try {
        [period, branches] = await Promise.all([
            fetchApi<ShiftPeriodView>(`/api/periods/${periodId}`),
            fetchApi<Branch[]>("/api/branches"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Edit period" message="You don't have access to edit this period." />;
        }
        if (error instanceof ApiError && error.status === 404) {
            return <AccessMessage title="Edit period" message="Period not found." />;
        }
        throw error;
    }

    const isOwner = (await getSession())?.role === OWNER_ROLE;

    // a manager can read a chain-wide period, but only the owner can change it (the API refuses with 403)
    if (period.branchId === null && !isOwner) {
        return <AccessMessage title="Edit period" message="Only the owner can change a period used by all branches." />;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">Edit {period.name}</h1>
            <PeriodForm
                mode="edit"
                branches={branches}
                canPickChainWide={isOwner}
                periodId={periodId}
                initialValues={{
                    branch: period.branchId ?? "chain-wide",
                    name: period.name,
                    defaultStart: period.defaultStart,
                    defaultEnd: period.defaultEnd,
                    sortOrder: period.sortOrder,
                }}
            />
        </div>
    );
}
