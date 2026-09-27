"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { completeInstance } from "@/lib/api/task-instances";
import { MAX_PHOTO_BYTES } from "@/lib/photo-limits";

/** Phone-first: take a photo, check the preview, mark the task done. The photo is the proof, so it is required. */
export function CompleteTaskForm({ instanceId }: { instanceId: number }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    // an object URL holds the photo in memory until it is revoked
    useEffect(() => () => {
        if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current);
    }, []);

    function replacePreview(next: string | null) {
        if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current);
        previewRef.current = next;
        setPreviewUrl(next);
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const chosen = event.target.files?.[0] ?? null;
        setError(null);

        if (chosen === null) return;

        // an empty type is let through: some phones leave it blank for HEIC, and the server sniffs the file
        if (chosen.type !== "" && !chosen.type.startsWith("image/")) {
            setError("That file isn't a photo.");
            return;
        }
        if (chosen.size > MAX_PHOTO_BYTES) {
            setError(`That photo is over ${MAX_PHOTO_BYTES / (1024 * 1024)} MB. Try a lower-resolution one.`);
            return;
        }

        setFile(chosen);
        replacePreview(URL.createObjectURL(chosen));
    }

    function submit() {
        if (file === null) return;

        setError(null);
        startTransition(async () => {
            try {
                await completeInstance(instanceId, file);
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
            }
        });
    }

    return (
        <div className="mt-3 flex flex-col gap-3">
            {/* capture is a hint: it opens the camera on a phone and the file picker on a desktop */}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                aria-hidden="true"
                tabIndex={-1}
                onChange={handleFileChange}
            />

            {previewUrl !== null ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local blob URL; next/image cannot optimise it
                <img src={previewUrl} alt="Your photo" className="max-h-64 w-full rounded-lg border border-border object-cover" />
            ) : null}

            {error !== null ? (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            {file === null ? (
                <Button type="button" variant="outline" size="lg" className="h-11" disabled={pending} onClick={() => inputRef.current?.click()}>
                    Take photo
                </Button>
            ) : (
                <div className="flex gap-2">
                    <Button type="button" size="lg" className="h-11 flex-1" disabled={pending} onClick={submit}>
                        {pending ? <Spinner data-icon="inline-start" /> : null}
                        Mark as done
                    </Button>
                    <Button type="button" variant="outline" size="lg" className="h-11" disabled={pending} onClick={() => inputRef.current?.click()}>
                        Retake
                    </Button>
                </div>
            )}
        </div>
    );
}
