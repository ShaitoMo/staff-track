import { BranchForm } from "@/components/branches/branch-form";
import { AccessMessage } from "@/components/layout/access-message";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Branch } from "@/types/branch";

export default async function EditBranchPage({
    params,
}: {
    params: Promise<{ branchId: string }>;
}) {
    const { branchId: branchIdParam } = await params;

    if (!/^\d+$/.test(branchIdParam)) {
        return <AccessMessage title="Edit branch" message="Invalid branch." />;
    }
    const branchId = Number(branchIdParam);

    const session = await getSession();

    if (session?.role !== OWNER_ROLE) {
        return <AccessMessage title="Edit branch" message="Only the owner can edit branches." />;
    }

    let branch: Branch;

    try {
        branch = await fetchApi<Branch>(`/api/branches/${branchId}`);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Edit branch" message="You don't have access to edit this branch." />;
        }
        if (error instanceof ApiError && error.status === 404) {
            return <AccessMessage title="Edit branch" message="Branch not found." />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-medium">Edit {branch.name}</h1>
            <BranchForm
                mode="edit"
                branchId={branchId}
                initialValues={{ name: branch.name, location: branch.location ?? undefined }}
            />
        </div>
    );
}
