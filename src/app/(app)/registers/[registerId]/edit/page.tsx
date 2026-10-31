import type { Metadata } from "next";
import { AccessMessage } from "@/components/layout/access-message";
import { RegisterForm } from "@/components/registers/register-form";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { Branch } from "@/types/branch";
import { Register } from "@/types/register";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).registers.editTitle };
}

export default async function EditRegisterPage({
    params,
}: {
    params: Promise<{ registerId: string }>;
}) {
    const [{ registerId: registerIdParam }, t] = await Promise.all([params, getDictionary()]);

    if (!/^\d+$/.test(registerIdParam)) {
        return <AccessMessage title={t.registers.editTitle} message={t.registers.invalid} />;
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
            return <AccessMessage title={t.registers.editTitle} message={t.registers.noEditAccess} />;
        }
        if (error instanceof ApiError && error.status === 404) {
            return <AccessMessage title={t.registers.editTitle} message={t.registers.notFound} />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.setup.editName(register.name)}</h1>
            <RegisterForm
                mode="edit"
                registerId={registerId}
                branches={branches}
                initialValues={{ branchId: register.branchId, name: register.name }}
            />
        </div>
    );
}
