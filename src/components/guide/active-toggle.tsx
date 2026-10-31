"use client";

import { useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import {
    deactivateNode,
    getDeactivationImpact,
    getReactivationImpact,
    reactivateNode,
    type GuideNode,
} from "@/lib/api/shelf-guide";
import type { DeactivationImpact, ReactivationImpact } from "@/types/shelf-guide";

/**
 * Deactivate or reactivate a section or folder. Both ask first, with the counts the API reports
 * before anything changes. Photos are only hidden or shown with their section or folder.
 */
export function ActiveToggle({ node, name, active }: { node: GuideNode; name: string; active: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [impact, setImpact] = useState<DeactivationImpact | ReactivationImpact | null>(null);
    const [error, setError] = useState<string | null>(null);
    const t = useT();

    function run(action: () => Promise<void>) {
        setError(null);
        startTransition(async () => {
            try {
                await action();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.common.somethingWentWrong);
                setImpact(null);
            }
        });
    }

    const ask = () => run(async () => setImpact(active ? await getDeactivationImpact(node) : await getReactivationImpact(node)));
    const confirm = () => run(async () => {
        await (active ? deactivateNode(node) : reactivateNode(node));
        setImpact(null);
        router.refresh();
    });

    return (
        <div className="flex flex-col items-end gap-1">
            <Button size="sm" variant="outline" disabled={pending} onClick={ask}>
                {pending && impact === null ? <Spinner data-icon="inline-start" /> : null}
                {active ? t.guide.deactivateWhat(node.kind) : t.guide.reactivateWhat(node.kind)}
            </Button>
            {error !== null ? <span className="text-xs text-destructive">{error}</span> : null}

            <AlertDialog open={impact !== null} onOpenChange={(open) => !open && setImpact(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{active ? t.guide.deactivateTitle(name) : t.guide.reactivateTitle(name)}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {impact === null
                                ? null
                                : active
                                  ? t.guide.deactivateImpact(impact.folders, impact.images)
                                  : t.guide.reactivateImpact(impact.folders, impact.images)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction disabled={pending} onClick={confirm}>
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            {active ? t.guide.deactivate : t.guide.reactivate}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
