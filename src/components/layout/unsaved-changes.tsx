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
import { leavingHref } from "@/lib/leave-guard";

/** True once the values differ from the ones the form started with. A page form mounts fresh on each visit, so its first render is the baseline. */
export function useIsDirty(values: unknown): boolean {
    const current = JSON.stringify(values);
    const [initial] = useState(current);
    return current !== initial;
}

/** "Discard your changes?", asked before a form with unsaved changes is closed or left. */
export function DiscardChangesDialog({
    open,
    onKeepEditing,
    onDiscard,
}: {
    open: boolean;
    onKeepEditing: () => void;
    onDiscard: () => void;
}) {
    const t = useT();
    return (
        <AlertDialog open={open} onOpenChange={(next) => !next && onKeepEditing()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t.common.discardChanges.title}</AlertDialogTitle>
                    <AlertDialogDescription>{t.common.discardChanges.description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t.common.discardChanges.keepEditing}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onDiscard}>
                        {t.common.discardChanges.discard}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * Guards a page form while it is `dirty`. Closing or reloading the tab gets the browser's own leave
 * prompt; an in-app link (the sidebar, a breadcrumb) is held in the capture phase, before Next's
 * `Link` sees it, and asked about here. Rendered by `FormCard` when given `dirty`. The browser's Back button is not covered: the App Router
 * has no hook to cancel it.
 */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
    const router = useRouter();
    const [leavingTo, setLeavingTo] = useState<string | null>(null);

    useEffect(() => {
        if (!dirty) return;

        function handleBeforeUnload(event: BeforeUnloadEvent) {
            event.preventDefault();
        }

        function handleClick(event: MouseEvent) {
            const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
            if (!(anchor instanceof HTMLAnchorElement)) return;

            const href = leavingHref(
                event,
                { href: anchor.href, target: anchor.target, download: anchor.hasAttribute("download") },
                window.location.href,
            );
            if (href === null) return;

            // Next's Link skips navigating a click that is already defaultPrevented; the link's own onClick
            // (a mobile nav closing itself) still runs
            event.preventDefault();
            setLeavingTo(href);
        }

        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("click", handleClick, true);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("click", handleClick, true);
        };
    }, [dirty]);

    return (
        <DiscardChangesDialog
            open={leavingTo !== null}
            onKeepEditing={() => setLeavingTo(null)}
            onDiscard={() => {
                if (leavingTo !== null) router.push(leavingTo);
                setLeavingTo(null);
            }}
        />
    );
}
