"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CameraIcon, ImageIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError, PhotoUploadError } from "@/lib/api-client";
import { completeInstance } from "@/lib/api/task-instances";
import { compressPhoto, UnreadablePhotoError } from "@/lib/compress-photo";
import { MAX_PHOTO_BYTES } from "@/lib/photo-limits";

/**
 * Phone-first: take a photo, check the preview, mark the task done. The photo is the proof, so it is required.
 * `taskLabel` names the task in each button's accessible name, since a list repeats these buttons per card.
 */
export function CompleteTaskForm({ instanceId, taskLabel }: { instanceId: number; taskLabel: string }) {
    const router = useRouter();
    const cameraRef = useRef<HTMLInputElement>(null);
    const libraryRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<string | null>(null);
    const [file, setFile] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // which picker's photo is being compressed: its button shows the spinner, and both stay disabled
    const [compressing, setCompressing] = useState<"camera" | "library" | null>(null);
    const [pending, startTransition] = useTransition();
    const t = useT();

    // an object URL holds the photo in memory until it is revoked
    useEffect(() => () => {
        if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current);
    }, []);

    function replacePreview(next: string | null) {
        if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current);
        previewRef.current = next;
        setPreviewUrl(next);
    }

    async function handleFileChange(source: "camera" | "library", event: React.ChangeEvent<HTMLInputElement>) {
        const chosen = event.target.files?.[0] ?? null;
        // let the same photo be picked again after an error
        event.target.value = "";
        setError(null);

        if (chosen === null) return;

        // an empty type is let through: some phones leave it blank for HEIC, and compressPhoto decodes it or refuses
        if (chosen.type !== "" && !chosen.type.startsWith("image/")) {
            setError(t.tasks.notAPhoto);
            return;
        }

        // the compressed JPEG is what gets previewed and uploaded, so the preview shows exactly what is sent
        let compressed: Blob;
        setCompressing(source);
        try {
            compressed = await compressPhoto(chosen);
        } catch (caught) {
            // the unreadable-photo message names a retake; anything else is a plain failure to read
            setError(caught instanceof UnreadablePhotoError ? t.tasks.unreadablePhoto : t.common.somethingWentWrong);
            return;
        } finally {
            setCompressing(null);
        }
        if (compressed.size > MAX_PHOTO_BYTES) {
            setError(t.tasks.photoTooBig(MAX_PHOTO_BYTES / (1024 * 1024)));
            return;
        }

        setFile(compressed);
        replacePreview(URL.createObjectURL(compressed));
    }

    // back to the Take / Choose choice, so a retake can come from either the camera or the gallery
    function retake() {
        setError(null);
        setFile(null);
        replacePreview(null);
    }

    function submit() {
        if (file === null) return;

        setError(null);
        startTransition(async () => {
            try {
                await completeInstance(instanceId, file);
                router.refresh();
            } catch (caught) {
                setError(
                    caught instanceof PhotoUploadError
                        ? t.common.photoUploadFailed
                        : caught instanceof ApiError
                          ? caught.message
                          : t.common.somethingWentWrong,
                );
            }
        });
    }

    return (
        <div className="mt-3 flex flex-col gap-3">
            {/* capture is a hint: it opens the camera on a phone and the file picker on a desktop */}
            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                aria-hidden="true"
                tabIndex={-1}
                onChange={(event) => handleFileChange("camera", event)}
            />
            {/* no capture: the phone's gallery / the desktop file picker, for a photo taken earlier */}
            <input
                ref={libraryRef}
                type="file"
                accept="image/*"
                hidden
                aria-hidden="true"
                tabIndex={-1}
                onChange={(event) => handleFileChange("library", event)}
            />

            {previewUrl !== null ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local blob URL; next/image cannot optimise it
                <img src={previewUrl} alt={t.tasks.yourPhoto} className="max-h-64 w-full rounded-lg border border-border object-cover" />
            ) : null}

            {error !== null ? (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            {file === null ? (
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-11 flex-1"
                        aria-label={t.tasks.takePhotoFor(taskLabel)}
                        disabled={compressing !== null}
                        onClick={() => cameraRef.current?.click()}
                    >
                        {compressing === "camera" ? <Spinner data-icon="inline-start" /> : <CameraIcon data-icon="inline-start" />}
                        {t.tasks.takePhoto}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-11 flex-1"
                        aria-label={t.tasks.choosePhotoFor(taskLabel)}
                        disabled={compressing !== null}
                        onClick={() => libraryRef.current?.click()}
                    >
                        {compressing === "library" ? <Spinner data-icon="inline-start" /> : <ImageIcon data-icon="inline-start" />}
                        {t.tasks.choosePhoto}
                    </Button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <Button type="button" size="lg" className="h-11 flex-1" aria-label={t.tasks.markDoneFor(taskLabel)} disabled={pending} onClick={submit}>
                        {pending ? <Spinner data-icon="inline-start" /> : null}
                        {t.tasks.markDone}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-11"
                        aria-label={t.tasks.retakeFor(taskLabel)}
                        disabled={pending}
                        onClick={retake}
                    >
                        {t.tasks.retake}
                    </Button>
                </div>
            )}
        </div>
    );
}
