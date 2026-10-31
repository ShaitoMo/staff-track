import type { Metadata } from "next";
import Link from "next/link";
import { AccessMessage } from "@/components/layout/access-message";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { BranchTable } from "@/components/branches/branch-table";
import { ApiError } from "@/lib/api-client";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Branch } from "@/types/branch";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).branches.title };
}

export default async function BranchesPage() {
    const [session, t] = await Promise.all([getSession(), getDictionary()]);
    const isOwner = session?.role === OWNER_ROLE;

    let branches: Branch[];

    try {
        branches = await fetchApi<Branch[]>("/api/branches");
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            return <AccessMessage title={t.branches.title} message={t.branches.noAccess} />;
        }
        throw error;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">{t.branches.title}</h1>
                {isOwner && (
                    <Link href="/branches/new" className={buttonVariants({ size: "sm" })}>
                        {t.branches.addBranch}
                    </Link>
                )}
            </div>
            {branches.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t.branches.noneFound}</EmptyTitle>
                        <EmptyDescription>{t.branches.noneYet}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <BranchTable branches={branches} canEdit={isOwner} />
            )}
        </div>
    );
}
