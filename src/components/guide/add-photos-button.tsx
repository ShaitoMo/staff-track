"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { addGuidePhoto } from "@/lib/api/shelf-guide";
import { UnreadablePhotoError } from "@/lib/compress-photo";
import { TOUCH_HEIGHT } from "@/lib/touch";

/**
 * The page's one main action. Several photos can be picked at once; they upload one after another
 * so each lands at the end of the level in the order picked, and a failure names the photo it hit.
 */
export function AddPhotosButton({ branchSectionId, folderId }: { branchSectionId: number; folderId: number | null }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function upload(event: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (files.length === 0) return;

        setError(null);
        for (const [index, file] of files.entries()) {
            setProgress({ done: index, total: files.length });
            try {
                await addGuidePhoto(branchSectionId, file, { folderId });
            } catch (caught) {
                const reason = caught instanceof ApiError || caught instanceof UnreadablePhotoError ? caught.message : "Something went wrong.";
                setError(files.length > 1 ? `Photo ${index + 1} (${file.name}): ${reason}` : reason);
                break;
            }
        }
        setProgress(null);
        router.refresh();
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <input ref={inputRef} type="file" accept="image/*" multiple hidden aria-hidden="true" tabIndex={-1} onChange={upload} />
            <Button disabled={progress !== null} onClick={() => inputRef.current?.click()} className={TOUCH_HEIGHT}>
                {progress !== null ? <Spinner data-icon="inline-start" /> : <ImagePlusIcon data-icon="inline-start" />}
                {progress !== null && progress.total > 1 ? `Uploading ${progress.done + 1} of ${progress.total}` : progress !== null ? "Uploading…" : "Add photos"}
            </Button>
            {error !== null ? <span role="alert" className="max-w-xs text-right text-xs text-destructive">{error}</span> : null}
        </div>
    );
}
