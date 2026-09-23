import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BranchForm } from "@/components/branches/branch-form";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { Branch } from "@/types/branch";

function AccessMessage({ message }: { message: string }) {
    return (
        <div>
            <h1 className="text-xl font-medium">Edit branch</h1>
            <Alert variant="destructive" className="mt-4">
                <AlertCircleIcon />
                <AlertDescription>{message}</AlertDescription>
            </Alert>
        </div>
    );
}

export default async function EditBranchPage({
    params,
}: {
    params: Promise<{ branchId: string }>;
}) {
    const { branchId: branchIdParam } = await params;

    if (!/^\d+$/.test(branchIdParam)) {
        return <AccessMessage message="Invalid branch." />;
    }
    const branchId = Number(branchIdParam);

    let branch: Branch;

    try {
        branch = await fetchApi<Branch>(`/api/branches/${branchId}`);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage message="You don't have access to edit this branch." />;
        }
        if (error instanceof ApiError && error.status === 404) {
            return <AccessMessage message="Branch not found." />;
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
