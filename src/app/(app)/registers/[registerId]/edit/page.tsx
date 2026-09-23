import { AccessMessage } from "@/components/layout/access-message";
import { RegisterForm } from "@/components/registers/register-form";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { Branch } from "@/types/branch";
import { Register } from "@/types/register";

export default async function EditRegisterPage({
    params,
}: {
    params: Promise<{ registerId: string }>;
}) {
    const { registerId: registerIdParam } = await params;

    if (!/^\d+$/.test(registerIdParam)) {
        return <AccessMessage title="Edit register" message="Invalid register." />;
    }
    const registerId = Number(registerIdParam);

    let register: Register;
    let branches: Branch[];

    try {
        [register, branches] = await Promise.all([
            fetchApi<Register>(`/api/registers/${registerId}`),
            fetchApi<Branch[]>("/api/branches"),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title="Edit register" message="You don't have access to edit this register." />;
        }
        if (error instanceof ApiError && error.status === 404) {
            return <AccessMessage title="Edit register" message="Register not found." />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-medium">Edit {register.name}</h1>
            <RegisterForm
                mode="edit"
                registerId={registerId}
                branches={branches}
                initialValues={{ branchId: register.branchId, name: register.name }}
            />
        </div>
    );
}
