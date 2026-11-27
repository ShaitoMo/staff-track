"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogInIcon } from "lucide-react";
import { useT } from "@/i18n/client";
import { SESSION_ENDED_EVENT } from "@/lib/api-client";
import { loginHref } from "@/lib/login-redirect";

/**
 * A band under the top bar once a save finds the session gone (a 401 only comes after the 7-day
 * refresh lapses, or a reset or deactivation). It links to sign-in and back to the page the save
 * failed on; what was typed isn't kept. The alert region stays mounted so the band is announced.
 */
export function SessionEndedNotice() {
    const t = useT();
    const [href, setHref] = useState<string | null>(null);

    useEffect(() => {
        const onEnded = () => setHref(loginHref(window.location.pathname + window.location.search));
        window.addEventListener(SESSION_ENDED_EVENT, onEnded);
        return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
    }, []);

    return (
        <div role="alert">
            {href === null ? null : (
                <p className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm text-foreground lg:px-6">
                    <LogInIcon className="size-4 shrink-0" aria-hidden />
                    {t.layout.sessionEnded}{" "}
                    <Link href={href} className="font-medium text-primary underline underline-offset-4">
                        {t.layout.signInAgain}
                    </Link>
                </p>
            )}
        </div>
    );
}
