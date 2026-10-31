"use client";

import { useEffect, useState } from "react";
import { BookImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { getTaskReference } from "@/lib/api/task-instances";
import { cn } from "@/lib/utils";
import type { GuideImageView } from "@/types/shelf-guide";

/**
 * The shelf-guide photos a task points at, loaded when shown (it only mounts inside an open
 * dialog). A thumbnail opens the full photo in a new tab, like PhotoLink, so a dialog never opens
 * a second one. Plain <img>: the URLs redirect to signed ones behind the session (see PhotoGrid).
 */
export function TaskReferencePhotos({ instanceId, className }: { instanceId: number; className?: string }) {
    const [images, setImages] = useState<GuideImageView[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const t = useT();

    useEffect(() => {
        let cancelled = false;
        getTaskReference(instanceId)
            .then((loaded) => { if (!cancelled) setImages(loaded); })
            .catch((caught) => { if (!cancelled) setError(caught instanceof ApiError ? caught.message : t.tasks.referencePhotosFailed); });
        return () => { cancelled = true; };
    }, [instanceId, t]);

    if (error !== null) return <p className="text-sm text-destructive">{error}</p>;
    if (images === null) return <Spinner />;
    if (images.length === 0) return <p className="text-sm text-muted-foreground">{t.tasks.noReferencePhotos}</p>;

    return (
        <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
            {images.map((image) => (
                <li key={image.imageId}>
                    <a
                        href={image.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
                        aria-label={t.tasks.openReferencePhoto(image.title)}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element -- see the component comment */}
                        <img src={image.thumbUrl} alt="" loading="lazy" className="aspect-[4/3] w-full bg-muted object-cover" />
                        {image.title ? <span className="truncate px-2 py-1.5 text-xs"><bdi>{image.title}</bdi></span> : null}
                    </a>
                </li>
            ))}
        </ul>
    );
}

/** The staff card's "How it should look": the reference opens in a dialog, before the worker takes their photo. */
export function TaskReferenceButton({ instanceId, name, taskLabel }: { instanceId: number; name: string; taskLabel: string }) {
    const t = useT();

    return (
        <Dialog>
            <DialogTrigger
                render={
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-11 w-full justify-start"
                        aria-label={t.tasks.howItShouldLookFor(taskLabel)}
                    />
                }
            >
                <BookImageIcon data-icon="inline-start" />
                <span className="truncate">{t.tasks.howItShouldLookName(name)}</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t.tasks.howItShouldLook}</DialogTitle>
                    <DialogDescription>{name}</DialogDescription>
                </DialogHeader>
                <TaskReferencePhotos instanceId={instanceId} />
            </DialogContent>
        </Dialog>
    );
}
