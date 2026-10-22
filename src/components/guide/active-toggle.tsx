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
import { ApiError } from "@/lib/api-client";
import {
    deactivateNode,
    getDeactivationImpact,
    getReactivationImpact,
    reactivateNode,
    type GuideNode,
} from "@/lib/api/shelf-guide";
import type { DeactivationImpact, ReactivationImpact } from "@/types/shelf-guide";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Deactivate or reactivate a section or folder. Both ask first, with the counts the API reports
 * before anything changes. Photos are only hidden or shown with their section or folder.
 */
export function ActiveToggle({ node, name, active }: { node: GuideNode; name: string; active: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [impact, setImpact] = useState<DeactivationImpact | ReactivationImpact | null>(null);
    const [error, setError] = useState<string | null>(null);

    function run(action: () => Promise<void>) {
        setError(null);
        startTransition(async () => {
            try {
                await action();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
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

    const what = node.kind === "section" ? "section" : "folder";

    return (
        <div className="flex flex-col items-end gap-1">
            <Button size="sm" variant="outline" disabled={pending} onClick={ask}>
                {pending && impact === null ? <Spinner data-icon="inline-start" /> : null}
                {active ? `Deactivate ${what}` : `Reactivate ${what}`}
            </Button>
            {error !== null ? <span className="text-xs text-destructive">{error}</span> : null}

            <AlertDialog open={impact !== null} onOpenChange={(open) => !open && setImpact(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{active ? `Deactivate “${name}”?` : `Reactivate “${name}”?`}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {impact === null ? null : active ? (
                                <>
                                    Staff will stop seeing it: {plural(impact.folders, "folder")} and{" "}
                                    {plural(impact.images, "photo")} will be hidden. Nothing is deleted.
                                </>
                            ) : (
                                <>
                                    {plural(impact.folders, "folder")} and {plural(impact.images, "photo")} will be
                                    visible to staff again.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={pending} onClick={confirm}>
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            {active ? "Deactivate" : "Reactivate"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
