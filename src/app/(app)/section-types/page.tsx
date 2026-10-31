import type { Metadata } from "next";
import { NewSectionTypeForm, SectionTypeActions } from "@/components/guide/guide-forms";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getDictionary } from "@/i18n/server";
import { fetchApi } from "@/lib/api-server";
import { OWNER_ROLE } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SectionTypeView } from "@/types/shelf-guide";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).guide.sectionTypesTitle };
}

/** The chain-wide list of areas (Dairy fridge, Checkout area) a branch picks its shelf-guide sections from. Owner edits; managers read. */
export default async function SectionTypesPage() {
    const [session, types, t] = await Promise.all([
        getSession(),
        fetchApi<SectionTypeView[]>("/api/section-types?includeInactive=true"),
        getDictionary(),
    ]);
    const isOwner = session?.role === OWNER_ROLE;

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">{t.guide.sectionTypesTitle}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{t.guide.sectionTypesIntro}</p>
            {isOwner ? <NewSectionTypeForm /> : null}
            {types.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t.guide.noSectionTypes}</EmptyTitle>
                        <EmptyDescription>{isOwner ? t.guide.addFirstOne : t.guide.onlyOwner}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <ul className="max-w-3xl divide-y divide-border rounded-lg border border-border bg-card">
                    {types.map((type) => (
                        <li key={type.sectionTypeId} className="flex min-h-11 flex-wrap items-center gap-3 px-3 py-2 text-sm">
                            <span className="min-w-0 flex-1 truncate font-medium">{type.name}</span>
                            <Badge variant="outline" className={cn(!type.isActive && "border-dashed text-muted-foreground")}>
                                {type.isActive ? t.guide.active : t.guide.inactive}
                            </Badge>
                            {isOwner ? (
                                <SectionTypeActions sectionTypeId={type.sectionTypeId} name={type.name} active={type.isActive} />
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
