import type { Metadata } from "next";
import { AccessMessage } from "@/components/layout/access-message";
import { PeriodForm } from "@/components/periods/period-form";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Branch } from "@/types/branch";

export const metadata: Metadata = { title: "New period" };

export default async function NewPeriodPage() {
    const session = await getSession();
    let branches: Branch[];

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="New period" message="You don't have access to create periods." />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">New period</h1>
            <PeriodForm mode="create" branches={branches} canPickChainWide={session?.role === OWNER_ROLE} />
        </div>
    );
}
