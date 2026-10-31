import type { Metadata } from "next";
import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { RegisterRow, RegisterTable } from "@/components/registers/register-table";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { getSelectedBranchId } from "@/lib/session";
import { Branch } from "@/types/branch";
import { Register } from "@/types/register";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).registers.title };
}

export default async function RegistersPage({
    searchParams,
}: {
    searchParams: Promise<{ branch?: string }>;
}) {
    const [{ branch }, t] = await Promise.all([searchParams, getDictionary()]);
    let branchId: number | undefined;
    let branches: Branch[];
    let registersByBranch: Register[][];

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
        branchId = await getSelectedBranchId(branch, branches);
        const shown = branchId !== undefined ? branches.filter((b) => b.branchId === branchId) : branches;
        registersByBranch = await Promise.all(
            shown.map((b) => fetchApi<Register[]>(`/api/branches/${b.branchId}/registers`)),
        );
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.registers.title} message={t.registers.noAccess} />;
        }
        throw error;
    }

    const branchNames = new Map(branches.map((b) => [b.branchId, b.name]));
    const rows: RegisterRow[] = registersByBranch.flat().map((register) => ({
        registerId: register.registerId,
        name: register.name,
        branchName: branchNames.get(register.branchId) ?? `#${register.branchId}`,
    }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">{t.registers.title}</h1>
                <Link href="/registers/new" className={buttonVariants({ size: "sm" })}>
                    {t.registers.addRegister}
                </Link>
            </div>
            {rows.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t.registers.noneFound}</EmptyTitle>
                        <EmptyDescription>{branchId !== undefined ? t.registers.noneAtBranch : t.registers.noneYet}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <RegisterTable rows={rows} />
            )}
        </div>
    );
}
