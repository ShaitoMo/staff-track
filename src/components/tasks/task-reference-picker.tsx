"use client";

import { useEffect, useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBranchSections, getFolderTree } from "@/lib/api/shelf-guide";
import { folderPathOptions } from "@/lib/guide-folder-paths";
import type { BranchSectionView } from "@/types/shelf-guide";

/** A section's root (folderId null) or a folder in it; sectionId null = no reference. */
export interface TaskReferenceChoice {
    sectionId: number | null;
    folderId: number | null;
}

export const NO_REFERENCE: TaskReferenceChoice = { sectionId: null, folderId: null };

// a Select can't hold null, so "none" stands in for it
const NONE = "none";

type FolderOption = ReturnType<typeof folderPathOptions>[number];

/**
 * Optional shelf-guide reference for a new task: pick a section of the chosen branch, then
 * optionally a folder in it. Only active ones are offered, the same rule createTask enforces.
 * The parent resets the choice when the branch changes; this reloads its lists to match.
 */
export function TaskReferencePicker({
    branchId,
    value,
    onChange,
    disabled,
}: {
    branchId: number | null;
    value: TaskReferenceChoice;
    onChange: (next: TaskReferenceChoice) => void;
    disabled: boolean;
}) {
    // each list remembers what it was loaded for, so a stale one reads as empty without a reset
    const [loadedSections, setLoadedSections] = useState<{ branchId: number; sections: BranchSectionView[] } | null>(null);
    const [loadedFolders, setLoadedFolders] = useState<{ sectionId: number; folders: FolderOption[] } | null>(null);
    const sections = loadedSections !== null && loadedSections.branchId === branchId ? loadedSections.sections : [];
    const folders = loadedFolders !== null && loadedFolders.sectionId === value.sectionId ? loadedFolders.folders : [];

    // a failed load just leaves nothing to pick: the reference is optional
    useEffect(() => {
        if (branchId === null) return;
        let cancelled = false;
        getBranchSections(branchId)
            .then((loaded) => { if (!cancelled) setLoadedSections({ branchId, sections: loaded }); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [branchId]);

    useEffect(() => {
        const sectionId = value.sectionId;
        if (sectionId === null) return;
        let cancelled = false;
        getFolderTree(sectionId)
            .then((loaded) => { if (!cancelled) setLoadedFolders({ sectionId, folders: folderPathOptions(loaded) }); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [value.sectionId]);

    const sectionName = (id: string) => sections.find((section) => String(section.branchSectionId) === id)?.name;
    const folderName = (id: string) => folders.find((folder) => String(folder.folderId) === id)?.label;
    const noSections = loadedSections !== null && loadedSections.branchId === branchId && sections.length === 0;

    return (
        <>
            <Field>
                <FieldLabel htmlFor="reference-section">Shelf-guide section (optional)</FieldLabel>
                <Select
                    value={value.sectionId !== null ? String(value.sectionId) : NONE}
                    onValueChange={(next) => onChange({ sectionId: next === null || next === NONE ? null : Number(next), folderId: null })}
                    disabled={disabled || branchId === null || noSections}
                >
                    <SelectTrigger id="reference-section" className="w-full">
                        <SelectValue>
                            {(id: string) => (id === NONE ? (branchId === null ? "Choose a branch first" : "None") : sectionName(id) ?? "None")}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {sections.map((section) => (
                            <SelectItem key={section.branchSectionId} value={String(section.branchSectionId)}>
                                {section.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <FieldDescription>
                    {noSections ? "This branch has no shelf-guide sections yet." : "Staff see its photos of how the work should look."}
                </FieldDescription>
            </Field>

            {value.sectionId !== null && folders.length > 0 ? (
                <Field>
                    <FieldLabel htmlFor="reference-folder">Folder (optional)</FieldLabel>
                    <Select
                        value={value.folderId !== null ? String(value.folderId) : NONE}
                        onValueChange={(next) => onChange({ ...value, folderId: next === null || next === NONE ? null : Number(next) })}
                        disabled={disabled}
                    >
                        <SelectTrigger id="reference-folder" className="w-full">
                            <SelectValue>
                                {(id: string) => (id === NONE ? "The section's own photos" : folderName(id) ?? "The section's own photos")}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>The section&apos;s own photos</SelectItem>
                            {folders.map((folder) => (
                                <SelectItem key={folder.folderId} value={String(folder.folderId)}>
                                    {folder.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            ) : null}
        </>
    );
}
