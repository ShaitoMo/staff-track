import type { Metadata } from "next";
import { AccessMessage } from "@/components/layout/access-message";
import { RegisterForm } from "@/components/registers/register-form";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { Branch } from "@/types/branch";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).registers.newTitle };
}

export default async function NewRegisterPage() {
    const t = await getDictionary();
    let branches: Branch[];

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.registers.newTitle} message={t.registers.noCreateAccess} />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.registers.newTitle}</h1>
            <RegisterForm mode="create" branches={branches} />
        </div>
    );
}
