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
import { updateTask } from "@/lib/api/tasks";

/**
 * Edit, and "delete" in the only sense the project allows: deactivate. Deactivating keeps the
 * task's history and photos and can be undone, but it takes the task away from staff, so it asks
 * first. Activating is harmless and goes straight through.
 */
export function TaskRowActions({ taskId, title, active }: { taskId: number; title: string; active: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const t = useT();

    function toggleActive() {
        setError(null);
        startTransition(async () => {
            try {
                await updateTask(taskId, { active: !active });
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.common.somethingWentWrong);
            } finally {
                setConfirming(false);
            }
        });
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
                <Link href={`/tasks/${taskId}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {t.common.edit}
                </Link>
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={active ? () => setConfirming(true) : toggleActive}
                >
                    {pending && !confirming ? <Spinner data-icon="inline-start" /> : null}
                    {active ? t.tasks.deactivate : t.tasks.activate}
                </Button>
            </div>
            {error !== null ? <span className="text-xs text-destructive">{error}</span> : null}

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t.tasks.deactivateTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{t.tasks.deactivateDescription(title)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction disabled={pending} onClick={toggleActive}>
                            {pending ? <Spinner data-icon="inline-start" /> : null}
                            {t.tasks.deactivate}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
