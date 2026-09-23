import { BranchForm } from "@/components/branches/branch-form";
import { AccessMessage } from "@/components/layout/access-message";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";

export default async function NewBranchPage() {
    const session = await getSession();

    if (session?.role !== OWNER_ROLE) {
        return <AccessMessage title="New branch" message="Only the owner can create branches." />;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-medium">New branch</h1>
            <BranchForm mode="create" />
        </div>
    );
}
