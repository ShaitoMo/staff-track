import type { Metadata } from "next";
import { BranchForm } from "@/components/branches/branch-form";
import { AccessMessage } from "@/components/layout/access-message";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Branch } from "@/types/branch";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).branches.editTitle };
}

export default async function EditBranchPage({
    params,
}: {
    params: Promise<{ branchId: string }>;
}) {
    const [{ branchId: branchIdParam }, t] = await Promise.all([params, getDictionary()]);

    if (!/^\d+$/.test(branchIdParam)) {
        return <AccessMessage title={t.branches.editTitle} message={t.branches.invalid} />;
    }
    const branchId = Number(branchIdParam);

    const session = await getSession();

    if (session?.role !== OWNER_ROLE) {
        return <AccessMessage title={t.branches.editTitle} message={t.branches.onlyOwnerEdit} />;
    }

    let branch: Branch;

    try {
        branch = await fetchApi<Branch>(`/api/branches/${branchId}`);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.branches.editTitle} message={t.branches.noEditAccess} />;
        }
        if (error instanceof ApiError && error.status === 404) {
            return <AccessMessage title={t.branches.editTitle} message={t.branches.notFound} />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.setup.editName(branch.name)}</h1>
            <BranchForm
                mode="edit"
                branchId={branchId}
                initialValues={{ name: branch.name, location: branch.location ?? undefined }}
            />
        </div>
    );
}
