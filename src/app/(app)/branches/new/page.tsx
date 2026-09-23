import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BranchForm } from "@/components/branches/branch-form";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";

export default async function NewBranchPage() {
    const session = await getSession();

    if (session?.role !== OWNER_ROLE) {
        return (
            <div>
                <h1 className="text-xl font-medium">New branch</h1>
                <Alert variant="destructive" className="mt-4">
                    <AlertCircleIcon />
                    <AlertDescription>Only the owner can create branches.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-medium">New branch</h1>
            <BranchForm mode="create" />
        </div>
    );
}
