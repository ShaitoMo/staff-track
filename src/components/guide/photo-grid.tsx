"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { deleteGuidePhoto, reorderGuidePhotos, replaceGuidePhoto, updateGuidePhotoTitle } from "@/lib/api/shelf-guide";
import { UnreadablePhotoError } from "@/lib/compress-photo";
import type { GuideImageView } from "@/types/shelf-guide";

/**
 * The photos at one level as a thumbnail grid (thumbnails only; the full photo loads on tap).
 * Plain <img>, not next/image: the optimizer fetches without the session cookie, and these
 * URLs redirect to short-lived signed ones.
 */
export function PhotoGrid({ images, canEdit }: { images: GuideImageView[]; canEdit: boolean }) {
    const [openId, setOpenId] = useState<number | null>(null);
    const index = images.findIndex((image) => image.imageId === openId);
    const open = index === -1 ? null : images[index];

    return (
        <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {images.map((image) => (
                    <li key={image.imageId}>
                        <button
                            type="button"
                            onClick={() => setOpenId(image.imageId)}
                            className="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left"
                            aria-label={`Open photo${image.title ? `: ${image.title}` : ""}`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element -- see the component comment */}
                            <img
                                src={image.thumbUrl}
                                alt=""
                                loading="lazy"
                                className="aspect-[4/3] w-full bg-muted object-cover group-hover:opacity-90"
                            />
                            {image.title ? <span className="truncate px-2 py-1.5 text-xs">{image.title}</span> : null}
                        </button>
                    </li>
                ))}
            </ul>

            <Dialog open={open !== null} onOpenChange={(isOpen) => !isOpen && setOpenId(null)}>
                <DialogContent className="sm:max-w-3xl">
                    {open !== null ? (
                        <PhotoDetail
                            key={`${open.imageId}-${open.version}`}
                            image={open}
                            images={images}
                            position={index}
                            canEdit={canEdit}
                            onClose={() => setOpenId(null)}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}

function PhotoDetail({
    image,
    images,
    position,
    canEdit,
    onClose,
}: {
    image: GuideImageView;
    images: GuideImageView[];
    position: number;
    canEdit: boolean;
    onClose: () => void;
}) {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState(image.title ?? "");
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function run(action: () => Promise<void>, close = false) {
        setError(null);
        startTransition(async () => {
            try {
                await action();
                if (close) onClose();
                router.refresh();
            } catch (caught) {
                setError(
                    caught instanceof ApiError || caught instanceof UnreadablePhotoError ? caught.message : "Something went wrong.",
                );
            }
        });
    }

    function move(offset: -1 | 1) {
        const ids = images.map((item) => item.imageId);
        [ids[position], ids[position + offset]] = [ids[position + offset], ids[position]];
        run(() => reorderGuidePhotos(image.branchSectionId, image.folderId, ids));
    }

    function replace(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) run(async () => void (await replaceGuidePhoto(image, file)));
    }

    return (
        <div className="flex flex-col gap-4">
            <DialogHeader>
                <DialogTitle>{image.title ?? "Reference photo"}</DialogTitle>
                <DialogDescription>
                    Photo {position + 1} of {images.length}
                </DialogDescription>
            </DialogHeader>

            {/* eslint-disable-next-line @next/next/no-img-element -- signed-URL redirect behind the session; see PhotoGrid */}
            <img src={image.fileUrl} alt={image.title ?? "Reference photo"} className="max-h-[60vh] min-h-48 w-full rounded-lg bg-muted object-contain" />

            {error !== null ? (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            {canEdit ? (
                <div className="flex flex-col gap-3 border-t border-border pt-3">
                    <form
                        className="flex items-end gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            run(() => updateGuidePhotoTitle(image.imageId, title));
                        }}
                    >
                        <Field className="flex-1">
                            <FieldLabel htmlFor={`title-${image.imageId}`}>Title</FieldLabel>
                            <Input
                                id={`title-${image.imageId}`}
                                value={title}
                                maxLength={200}
                                disabled={pending}
                                placeholder="e.g. Top shelf, front"
                                onChange={(event) => setTitle(event.target.value)}
                            />
                        </Field>
                        <Button type="submit" variant="outline" disabled={pending || title === (image.title ?? "")}>
                            Save title
                        </Button>
                    </form>

                    <input ref={fileRef} type="file" accept="image/*" hidden aria-hidden="true" tabIndex={-1} onChange={replace} />
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            Replace photo
                        </Button>
                        <Button variant="ghost" size="sm" disabled={pending || position === 0} onClick={() => move(-1)}>
                            <ArrowLeftIcon data-icon="inline-start" /> Move earlier
                        </Button>
                        <Button variant="ghost" size="sm" disabled={pending || position === images.length - 1} onClick={() => move(1)}>
                            Move later <ArrowRightIcon data-icon="inline-end" />
                        </Button>
                        <span className="flex-1" />
                        {confirmDelete ? (
                            <>
                                <span className="text-xs text-muted-foreground">Delete for good? This can&apos;t be undone.</span>
                                <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmDelete(false)}>
                                    Keep
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() => run(() => deleteGuidePhoto(image.imageId), true)}
                                >
                                    Delete
                                </Button>
                            </>
                        ) : (
                            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmDelete(true)}>
                                Delete
                            </Button>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
