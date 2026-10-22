import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon, InfoIcon } from "lucide-react";
import { ActiveToggle } from "@/components/guide/active-toggle";
import { AddPhotosButton } from "@/components/guide/add-photos-button";
import { NewFolderForm, RenameFolder } from "@/components/guide/guide-forms";
import { GuideLinkList } from "@/components/guide/guide-link-list";
import { PhotoGrid } from "@/components/guide/photo-grid";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ApiError } from "@/lib/api-client";
import { fetchApi } from "@/lib/api-server";
import { canEditGuide } from "@/lib/rbac";
import { parseNumericId } from "@/lib/route-utils";
import { getSession } from "@/lib/session";
import { BranchSectionView, GuideFolderView, GuideImageView } from "@/types/shelf-guide";

export const metadata: Metadata = { title: "Shelf guide" };

/** A deeper chain than this is a loop in bad data, not a real folder tree. */
const MAX_DEPTH = 50;

/** Another branch's id, or something hidden from staff, comes back 404 from the API: show the page's 404. */
async function readOrNotFound<T>(path: string): Promise<T> {
    try {
        return await fetchApi<T>(path);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) notFound();
        throw error;
    }
}

/** The open folder and its ancestors, root first. */
async function folderPath(branchSectionId: number, folderId: number | undefined): Promise<GuideFolderView[]> {
    const path: GuideFolderView[] = [];
    let next = folderId;

    while (next !== undefined && path.length < MAX_DEPTH) {
        const folder = await readOrNotFound<GuideFolderView>(`/api/folders/${next}`);
        if (folder.branchSectionId !== branchSectionId) notFound();
        path.unshift(folder);
        next = folder.parentFolderId ?? undefined;
    }

    return path;
}

export default async function GuideSectionPage({
    params,
    searchParams,
}: {
    params: Promise<{ sectionId: string }>;
    searchParams: Promise<{ folder?: string }>;
}) {
    const [{ sectionId: sectionParam }, { folder: folderParam }, session] = await Promise.all([params, searchParams, getSession()]);
    const sectionId = parseNumericId(sectionParam);
    const folderId = folderParam === undefined ? undefined : parseNumericId(folderParam);
    if (sectionId === null || folderId === null) notFound();

    // the level's folders and photos only need the id from the URL, so they load alongside the path walk
    const folderQuery = folderId === undefined ? "" : String(folderId);
    const [section, path, folders, images] = await Promise.all([
        readOrNotFound<BranchSectionView>(`/api/branch-sections/${sectionId}`),
        folderPath(sectionId, folderId),
        readOrNotFound<GuideFolderView[]>(`/api/branch-sections/${sectionId}/folders?parentFolderId=${folderQuery}&includeInactive=true`),
        readOrNotFound<GuideImageView[]>(`/api/branch-sections/${sectionId}/guide-images?folderId=${folderQuery}`),
    ]);
    const current = path.at(-1);
    // reactivating a folder needs an active parent (the API refuses otherwise), so only offer it then
    const parentActive = path.at(-2)?.isActive ?? true;

    const canEdit = session !== null && canEditGuide(session);
    const name = current?.name ?? section.name;
    const active = section.isActive && (current?.isActive ?? true);
    const hrefFor = (folderId?: number) => `/guide/${sectionId}${folderId === undefined ? "" : `?folder=${folderId}`}`;

    return (
        <div className="flex flex-col gap-6">
            <nav aria-label="Where you are" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                <Link href={`/guide?branch=${section.branchId}`} className="hover:text-foreground hover:underline">Shelf guide</Link>
                <ChevronRightIcon aria-hidden className="size-3.5" />
                {path.length === 0 ? (
                    <span aria-current="page" className="text-foreground">{section.name}</span>
                ) : (
                    <Link href={hrefFor()} className="hover:text-foreground hover:underline">{section.name}</Link>
                )}
                {path.map((folder, index) => (
                    <span key={folder.folderId} className="flex items-center gap-1">
                        <ChevronRightIcon aria-hidden className="size-3.5" />
                        {index === path.length - 1 ? (
                            <span aria-current="page" className="text-foreground">{folder.name}</span>
                        ) : (
                            <Link href={hrefFor(folder.folderId)} className="hover:text-foreground hover:underline">{folder.name}</Link>
                        )}
                    </span>
                ))}
            </nav>

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <h1 className="truncate text-xl font-semibold">{name}</h1>
                        {active ? null : <Badge variant="outline" className="border-dashed text-muted-foreground">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{section.branchName}</p>
                </div>
                {canEdit && active ? <AddPhotosButton branchSectionId={sectionId} folderId={current?.folderId ?? null} /> : null}
            </div>

            {canEdit ? (
                <div className="flex flex-wrap items-start justify-end gap-2 border-y border-border py-2">
                    {current !== undefined ? <RenameFolder folderId={current.folderId} name={current.name} /> : null}
                    {current !== undefined && section.isActive && (current.isActive || parentActive) ? (
                        <ActiveToggle node={{ kind: "folder", id: current.folderId }} name={current.name} active={current.isActive} />
                    ) : null}
                    {current === undefined ? (
                        <ActiveToggle node={{ kind: "section", id: sectionId }} name={section.name} active={section.isActive} />
                    ) : null}
                </div>
            ) : null}

            {canEdit && !active ? (
                <Alert>
                    <InfoIcon />
                    <AlertDescription>
                        {!section.isActive
                            ? "This section is inactive: staff can't see it or its photos. Reactivate the section to show them again."
                            : parentActive
                              ? "This folder is inactive: staff can't see it or its photos. Reactivate it to show them again."
                              : "This folder is inactive because a folder above it is. Reactivate that folder first; this one comes back with it."}
                    </AlertDescription>
                </Alert>
            ) : null}

            {folders.length > 0 || (canEdit && active) ? (
                <section aria-labelledby="folders-heading" className="flex flex-col gap-3">
                    <h2 id="folders-heading" className="text-base font-semibold">Folders</h2>
                    {folders.length > 0 ? (
                        <GuideLinkList
                            kind="folder"
                            items={folders.map((folder) => ({ href: hrefFor(folder.folderId), name: folder.name, active: folder.isActive }))}
                        />
                    ) : null}
                    {canEdit && active ? <NewFolderForm branchSectionId={sectionId} parentFolderId={current?.folderId ?? null} /> : null}
                </section>
            ) : null}

            <section aria-labelledby="photos-heading" className="flex flex-col gap-3">
                <h2 id="photos-heading" className="text-base font-semibold">Photos</h2>
                {images.length > 0 ? (
                    <PhotoGrid images={images} canEdit={canEdit} />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {canEdit && active ? "No photos here yet. Add photos of how this area should look." : "No photos here."}
                    </p>
                )}
            </section>
        </div>
    );
}
