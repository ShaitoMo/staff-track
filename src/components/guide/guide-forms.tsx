"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { InlineNameForm } from "@/components/guide/inline-name-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { createFolder, createSectionType, renameFolder, updateSectionType } from "@/lib/api/shelf-guide";

// Client wrappers: a server page can't hand InlineNameForm the function it calls.

export function NewFolderForm({ branchSectionId, parentFolderId }: { branchSectionId: number; parentFolderId: number | null }) {
    const t = useT();

    return (
        <InlineNameForm
            id="new-folder"
            label={t.guide.newFolder}
            submitLabel={t.guide.addFolder}
            maxLength={200}
            onSubmit={(name) => createFolder(branchSectionId, name, parentFolderId)}
        />
    );
}

export function NewSectionTypeForm() {
    const t = useT();

    return (
        <InlineNameForm
            id="new-section-type"
            label={t.guide.newSectionType}
            submitLabel={t.guide.addSectionType}
            maxLength={128}
            primary
            onSubmit={(name) => createSectionType({ name })}
        />
    );
}

/** A name shown as text with a Rename button that turns it into a field in place. */
function RenameInPlace({ name, label, maxLength, save }: { name: string; label: string; maxLength: number; save: (name: string) => Promise<void> }) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(name);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const t = useT();

    if (!editing) {
        return (
            <Button variant="ghost" size="sm" onClick={() => { setValue(name); setEditing(true); }}>
                {t.guide.rename}
            </Button>
        );
    }

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = value.trim();
        if (trimmed === "" || trimmed === name) {
            setEditing(false);
            return;
        }
        startTransition(async () => {
            try {
                await save(trimmed);
                setEditing(false);
                setError(null);
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.common.somethingWentWrong);
            }
        });
    }

    return (
        <form onSubmit={submit} className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
                <Input
                    aria-label={label}
                    value={value}
                    maxLength={maxLength}
                    disabled={pending}
                    autoFocus
                    className="h-8 w-48"
                    onChange={(event) => setValue(event.target.value)}
                />
                <Button type="submit" size="sm" variant="outline" disabled={pending}>
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    {t.common.save}
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
                    {t.common.cancel}
                </Button>
            </div>
            {error !== null ? <span className="text-xs text-destructive">{error}</span> : null}
        </form>
    );
}

export function RenameFolder({ folderId, name }: { folderId: number; name: string }) {
    const t = useT();
    return <RenameInPlace name={name} label={t.guide.folderName} maxLength={200} save={(next) => renameFolder(folderId, next)} />;
}

/** Rename, and switch on/off. A section type never cascades, so neither asks first. */
export function SectionTypeActions({ sectionTypeId, name, active }: { sectionTypeId: number; name: string; active: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const t = useT();

    function toggle() {
        setError(null);
        startTransition(async () => {
            try {
                await updateSectionType(sectionTypeId, { isActive: !active });
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.common.somethingWentWrong);
            }
        });
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-start gap-2">
                <RenameInPlace
                    name={name}
                    label={t.guide.newNameFor(name)}
                    maxLength={128}
                    save={(next) => updateSectionType(sectionTypeId, { name: next })}
                />
                <Button size="sm" variant="ghost" disabled={pending} onClick={toggle}>
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    {active ? t.guide.deactivate : t.guide.activate}
                </Button>
            </div>
            {error !== null ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
    );
}
