"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useT } from "@/i18n/client";
import { SESSION_ENDED_EVENT } from "@/lib/api-client";
import { loginHref } from "@/lib/login-redirect";

/**
 * Asks the User to sign in again once a save finds the session gone (a 401 only comes after the
 * 7-day refresh lapses, or a reset or deactivation). An alert dialog rather than a band, so it opens
 * over a form's own dialog instead of behind it. Signing in comes back to this page; what was typed
 * isn't kept. The button navigates with the router, not a link, so UnsavedChangesGuard doesn't ask
 * a second time.
 */
export function SessionEndedNotice() {
    const t = useT();
    const router = useRouter();
    const [href, setHref] = useState<string | null>(null);

    useEffect(() => {
        const onEnded = () => setHref(loginHref(window.location.pathname + window.location.search));
        window.addEventListener(SESSION_ENDED_EVENT, onEnded);
        return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
    }, []);

    return (
        <AlertDialog open={href !== null} onOpenChange={(open) => !open && setHref(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t.layout.sessionEnded.title}</AlertDialogTitle>
                    <AlertDialogDescription>{t.layout.sessionEnded.description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t.layout.sessionEnded.notNow}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => href && router.push(href)}>
                        {t.layout.sessionEnded.signIn}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
