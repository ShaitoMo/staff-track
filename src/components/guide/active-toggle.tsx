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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
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
 * before anything changes; reactivating offers to bring back the photos the deactivation recycled.
 */
export function ActiveToggle({ node, name, active }: { node: GuideNode; name: string; active: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [impact, setImpact] = useState<DeactivationImpact | ReactivationImpact | null>(null);
    const [restoreImages, setRestoreImages] = useState(true);
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
        await (active ? deactivateNode(node) : reactivateNode(node, restoreImages));
        setImpact(null);
        router.refresh();
    });

    const what = node.kind === "section" ? "section" : "folder";
    const lost = impact !== null && "permanentlyLost" in impact ? impact.permanentlyLost : 0;

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
                                    Staff will stop seeing it. {plural(impact.folders, "folder")} will be hidden
                                    and {plural(impact.images, "photo")} will move to the recycle bin.
                                </>
                            ) : (
                                <>
                                    {plural(impact.folders, "folder")} will come back.
                                    {lost > 0 ? ` ${plural(lost, "photo")} were already purged and can't be restored.` : null}
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {!active && impact !== null && impact.images > 0 ? (
                        <Field orientation="horizontal">
                            <Checkbox
                                id={`restore-${node.kind}-${node.id}`}
                                checked={restoreImages}
                                disabled={pending}
                                onCheckedChange={(checked) => setRestoreImages(checked === true)}
                            />
                            <FieldLabel htmlFor={`restore-${node.kind}-${node.id}`} className="font-normal">
                                Also restore {plural(impact.images, "photo")} from the recycle bin
                            </FieldLabel>
                        </Field>
                    ) : null}
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
