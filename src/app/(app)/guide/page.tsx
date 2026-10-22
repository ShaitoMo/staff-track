import type { Metadata } from "next";
import Link from "next/link";
import { AddSectionForm } from "@/components/guide/add-section-form";
import { GuideLinkList } from "@/components/guide/guide-link-list";
import { BranchStack } from "@/components/layout/branch-stack";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { fetchApi } from "@/lib/api-server";
import { canEditGuide, OWNER_ROLE } from "@/lib/rbac";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { Branch } from "@/types/branch";
import { BranchSectionView, SectionTypeView } from "@/types/shelf-guide";

export const metadata: Metadata = { title: "Shelf guide" };

const toLinks = (sections: BranchSectionView[]) =>
    sections.map((section) => ({ href: `/guide/${section.branchSectionId}`, name: section.name, active: section.isActive }));

/** Reference photos of how each area should look (FR12). Staff see every branch they work at; owners and managers follow the branch switcher. */
export default async function GuidePage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
    const session = await getSession();

    if (session === null || !canEditGuide(session)) {
        return <StaffGuide branchIds={session?.branchIds ?? []} />;
    }

    const { branch } = await searchParams;
    const [branches, types] = await Promise.all([
        fetchApi<Branch[]>("/api/branches"),
        fetchApi<SectionTypeView[]>("/api/section-types"),
    ]);
    const branchId = await getSelectedBranchId(branch, branches);
    const shown = branchId === undefined ? undefined : branches.find((b) => b.branchId === branchId);
    const isOwner = session.role === OWNER_ROLE;

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">Shelf guide</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
                Reference photos of how each area of a branch should look. Staff see the active sections of their branches.
            </p>
            {types.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {isOwner ? (
                        <>
                            Start by adding the kinds of area your branches have under{" "}
                            <Link href="/section-types" className="text-primary hover:underline">Section types</Link>.
                        </>
                    ) : (
                        "The owner hasn't added any section types yet."
                    )}
                </p>
            ) : null}
            {shown !== undefined ? (
                <ManagedBranch branchId={shown.branchId} types={types} primary />
            ) : (
                <BranchStack branches={branches} basePath="/guide" query={{}}>
                    {(b) => <ManagedBranch branchId={b.branchId} types={types} primary={false} />}
                </BranchStack>
            )}
        </div>
    );
}

async function ManagedBranch({ branchId, types, primary }: { branchId: number; types: SectionTypeView[]; primary: boolean }) {
    const sections = await fetchApi<BranchSectionView[]>(`/api/branches/${branchId}/sections?includeInactive=true`);
    const taken = new Set(sections.map((section) => section.sectionTypeId));
    const available = types.filter((type) => !taken.has(type.sectionTypeId));

    return (
        <div className="flex flex-col gap-4">
            {sections.length === 0 ? (
                <p className="text-sm text-muted-foreground">This branch has no sections yet.</p>
            ) : (
                <GuideLinkList items={toLinks(sections)} kind="section" />
            )}
            {available.length > 0 ? <AddSectionForm branchId={branchId} types={available} primary={primary} /> : null}
        </div>
    );
}

async function StaffGuide({ branchIds }: { branchIds: number[] }) {
    const perBranch = await Promise.all(
        branchIds.map((id) => fetchApi<BranchSectionView[]>(`/api/branches/${id}/sections`)),
    );
    const withSections = perBranch.filter((sections) => sections.length > 0);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">Shelf guide</h1>
            {withSections.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>No guide yet</EmptyTitle>
                        <EmptyDescription>Your manager hasn&apos;t added reference photos for your branch.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : withSections.length === 1 ? (
                <GuideLinkList items={toLinks(withSections[0])} kind="section" />
            ) : (
                withSections.map((sections) => (
                    <section key={sections[0].branchId} className="flex flex-col gap-2">
                        <h2 className="text-base font-semibold">{sections[0].branchName}</h2>
                        <GuideLinkList items={toLinks(sections)} kind="section" />
                    </section>
                ))
            )}
        </div>
    );
}
