"use client";

import { useState } from "react";
import { ImageOffIcon } from "lucide-react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

/**
 * A stored photo as a plain <img> (not next/image: the optimizer fetches without the session cookie,
 * and these URLs redirect to short-lived signed ones). If the file is gone or access was refused, it
 * shows a muted "Photo unavailable" tile in the same box instead of the browser's broken-image icon.
 * `className` sizes both, so the tile takes the image's place without shifting the layout.
 */
export function PhotoImage({ src, alt, className, loading }: {
    src: string;
    alt: string;
    className?: string;
    loading?: "lazy";
}) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const t = useT();

    // keyed on src, so a replaced photo (new ?v=) gets a fresh try
    if (failedSrc === src) {
        return (
            <span
                role="img"
                aria-label={t.common.photoUnavailable.title}
                className={cn(className, "flex flex-col items-center justify-center gap-1 text-muted-foreground")}
            >
                <ImageOffIcon className="size-5" aria-hidden="true" />
                <span className="text-xs">{t.common.photoUnavailable.title}</span>
            </span>
        );
    }

    // eslint-disable-next-line @next/next/no-img-element -- see the component comment
    return <img src={src} alt={alt} loading={loading} className={className} onError={() => setFailedSrc(src)} />;
}
