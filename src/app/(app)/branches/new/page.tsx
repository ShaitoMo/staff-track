import type { Metadata } from "next";
import { BranchForm } from "@/components/branches/branch-form";
import { AccessMessage } from "@/components/layout/access-message";
import { OWNER_ROLE } from "@/lib/rbac";
import { getDictionary } from "@/i18n/server";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).branches.newTitle };
}

export default async function NewBranchPage() {
    const [session, t] = await Promise.all([getSession(), getDictionary()]);

    if (session?.role !== OWNER_ROLE) {
        return <AccessMessage title={t.branches.newTitle} message={t.branches.onlyOwnerCreate} />;
    }

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.branches.newTitle}</h1>
            <BranchForm mode="create" />
        </div>
    );
}
