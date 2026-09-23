import { AccessMessage } from "@/components/layout/access-message";
import { RegisterForm } from "@/components/registers/register-form";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { Branch } from "@/types/branch";

export default async function NewRegisterPage() {
    let branches: Branch[];

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="New register" message="You don't have access to create registers." />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-medium">New register</h1>
            <RegisterForm mode="create" branches={branches} />
        </div>
    );
}
