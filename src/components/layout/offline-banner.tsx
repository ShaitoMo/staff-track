"use client";

import { useSyncExternalStore } from "react";
import { WifiOffIcon } from "lucide-react";
import { useT } from "@/i18n/client";

function subscribe(onChange: () => void) {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
    };
}

/**
 * A band under the top bar while the browser reports no connection. It only tells: nothing is
 * queued or retried. The status region stays mounted so going offline is announced.
 */
export function OfflineBanner() {
    const t = useT();
    const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

    return (
        <div role="status">
            {online ? null : (
                <p className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm text-foreground lg:px-6">
                    <WifiOffIcon className="size-4 shrink-0" aria-hidden />
                    {t.layout.offline}
                </p>
            )}
        </div>
    );
}
