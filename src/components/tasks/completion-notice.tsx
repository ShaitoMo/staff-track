"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CircleCheckIcon } from "lucide-react";
import { useT } from "@/i18n/client";

const SHOWN_MS = 6000;

/** Outside a provider (the manager screens) completing a task announces nothing extra. */
const AnnounceContext = createContext<(taskLabel: string) => void>(() => {});

export const useAnnounceCompletion = () => useContext(AnnounceContext);

/**
 * Says a task went for review once its card is gone. The card unmounts on the refresh that follows a
 * completion, so the message lives here, above the list, and focus moves to the page instead of
 * falling back to <body>. The live region is always mounted, so screen readers announce it.
 */
export function CompletionNoticeProvider({ children }: { children: React.ReactNode }) {
    const t = useT();
    const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

    useEffect(() => {
        if (notice === null) return;
        const timer = setTimeout(() => setNotice(null), SHOWN_MS);
        return () => clearTimeout(timer);
    }, [notice]);

    const announce = useCallback(
        (taskLabel: string) => {
            setNotice((previous) => ({ id: (previous?.id ?? 0) + 1, text: t.tasks.sentForReview(taskLabel) }));
            document.getElementById("main")?.focus({ preventScroll: true });
        },
        [t],
    );

    return (
        <AnnounceContext.Provider value={announce}>
            {children}
            {/* above the phone tab bar; a floating, temporary surface, so it is the one place with a shadow */}
            <div
                role="status"
                aria-live="polite"
                className="pointer-events-none fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-6"
            >
                {notice !== null ? (
                    <p
                        key={notice.id}
                        className="flex max-w-md items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg"
                    >
                        <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                        {notice.text}
                    </p>
                ) : null}
            </div>
        </AnnounceContext.Provider>
    );
}
