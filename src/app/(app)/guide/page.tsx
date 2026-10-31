import type { Metadata } from "next";
import Link from "next/link";
import { AddSectionForm } from "@/components/guide/add-section-form";
import { GuideLinkList } from "@/components/guide/guide-link-list";
import { BranchStack } from "@/components/layout/branch-stack";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getDictionary } from "@/i18n/server";
import type { Dictionary } from "@/i18n/dictionaries";
import { fetchApi } from "@/lib/api-server";
import { canEditGuide, OWNER_ROLE } from "@/lib/rbac";
import { getSelectedBranchId, getSession } from "@/lib/session";
import { Branch } from "@/types/branch";
import { BranchSectionView, SectionTypeView } from "@/types/shelf-guide";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).guide.title };
}

const toLinks = (sections: BranchSectionView[]) =>
    sections.map((section) => ({ href: `/guide/${section.branchSectionId}`, name: section.name, active: section.isActive }));

/** Reference photos of how each area should look (FR12). Staff see every branch they work at; owners and managers follow the branch switcher. */
export default async function GuidePage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
    const [session, t] = await Promise.all([getSession(), getDictionary()]);

    if (session === null || !canEditGuide(session)) {
        return <StaffGuide branchIds={session?.branchIds ?? []} t={t} />;
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
            <h1 className="text-xl font-semibold">{t.guide.title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{t.guide.intro}</p>
            {types.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {isOwner
                        ? t.guide.startWithTypes(
                              <Link href="/section-types" className="text-primary hover:underline">
                                  {t.guide.sectionTypesLink}
                              </Link>,
                          )
                        : t.guide.noTypesYet}
                </p>
            ) : null}
            {shown !== undefined ? (
                <ManagedBranch branchId={shown.branchId} types={types} primary t={t} />
            ) : (
                <BranchStack branches={branches} basePath="/guide" query={{}}>
                    {(b) => <ManagedBranch branchId={b.branchId} types={types} primary={false} t={t} />}
                </BranchStack>
            )}
        </div>
    );
}

async function ManagedBranch({ branchId, types, primary, t }: { branchId: number; types: SectionTypeView[]; primary: boolean; t: Dictionary }) {
    const sections = await fetchApi<BranchSectionView[]>(`/api/branches/${branchId}/sections?includeInactive=true`);
    const taken = new Set(sections.map((section) => section.sectionTypeId));
    const available = types.filter((type) => !taken.has(type.sectionTypeId));

    return (
        <div className="flex flex-col gap-4">
            {sections.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.guide.noSectionsYet}</p>
            ) : (
                <GuideLinkList items={toLinks(sections)} kind="section" />
            )}
            {available.length > 0 ? <AddSectionForm branchId={branchId} types={available} primary={primary} /> : null}
        </div>
    );
}

async function StaffGuide({ branchIds, t }: { branchIds: number[]; t: Dictionary }) {
    const perBranch = await Promise.all(
        branchIds.map((id) => fetchApi<BranchSectionView[]>(`/api/branches/${id}/sections`)),
    );
    const withSections = perBranch.filter((sections) => sections.length > 0);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.guide.title}</h1>
            {withSections.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t.guide.noGuideYet}</EmptyTitle>
                        <EmptyDescription>{t.guide.noGuideYetDescription}</EmptyDescription>
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
