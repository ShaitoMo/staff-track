"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { deletePeriod, setPeriodActive } from "@/lib/api/periods";
import { cn } from "@/lib/utils";

type Confirming = "deactivate" | "delete" | null;

/**
 * Edit, activate/deactivate, and delete. Deactivating is how a period in use is retired — it hides
 * the period from the schedule and coverage but keeps shifts already on it — so it asks first;
 * activating is harmless and goes straight through. Delete only succeeds for a period nothing
 * uses; otherwise the API's message (deactivate it instead) shows under the buttons.
 */
export function PeriodRowActions({ periodId, name, active }: { periodId: number; name: string; active: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [confirming, setConfirming] = useState<Confirming>(null);
    const [error, setError] = useState<string | null>(null);
    const t = useT();

    function run(action: () => Promise<void>) {
        setError(null);
        startTransition(async () => {
            try {
                await action();
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.common.somethingWentWrong);
            } finally {
                setConfirming(null);
            }
        });
    }

    const toggleActive = () => run(() => setPeriodActive(periodId, !active));
    const remove = () => run(() => deletePeriod(periodId));

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
                <Link href={`/periods/${periodId}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    {t.periods.edit}
                </Link>
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={active ? () => setConfirming("deactivate") : toggleActive}
                >
                    {pending && confirming === null ? <Spinner data-icon="inline-start" /> : null}
                    {active ? t.periods.deactivate : t.periods.activate}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming("delete")}>
                    {t.periods.delete}
                </Button>
            </div>
            {error !== null ? <span className="text-xs text-destructive">{error}</span> : null}

            <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirming === "delete" ? t.periods.deleteTitle : t.periods.deactivateTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirming === "delete" ? t.periods.deleteDescription(name) : t.periods.deactivateDescription(name)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                            variant={confirming === "delete" ? "destructive" : "default"}
                            disabled={pending}
                            onClick={confirming === "delete" ? remove : toggleActive}
                        >
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            {confirming === "delete" ? t.periods.delete : t.periods.deactivate}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
