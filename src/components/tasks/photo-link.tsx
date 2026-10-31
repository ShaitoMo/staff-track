"use client";

import { useT } from "@/i18n/client";

/** Opens a task's photo in a new tab. A plain link, not next/image: the optimizer fetches without the session cookie. */
export function PhotoLink({ mediaId, className }: { mediaId: number; className?: string }) {
    const t = useT();

    return (
        <a
            href={`/api/media/${mediaId}/file`}
            target="_blank"
            rel="noreferrer"
            className={className ?? "text-xs text-primary hover:underline"}
        >
            {t.tasks.viewPhoto}
        </a>
    );
}
