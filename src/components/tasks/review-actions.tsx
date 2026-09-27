"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { reviewInstance } from "@/lib/api/task-instances";

/** Approve or decline one completed instance. Decline is final, so it asks once more first. */
export function ReviewActions({ instanceId }: { instanceId: number }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [confirmingDecline, setConfirmingDecline] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function review(decision: "verified" | "rejected") {
        setError(null);
        startTransition(async () => {
            try {
                await reviewInstance(instanceId, decision);
                router.refresh();
            } catch (caught) {
                setConfirmingDecline(false);
                setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
            }
        });
    }

    if (confirmingDecline) {
        return (
            <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-muted-foreground">A declined task can&apos;t be redone.</span>
                <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => review("rejected")}>
                        {pending ? <Spinner data-icon="inline-start" /> : null}
                        Confirm decline
                    </Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmingDecline(false)}>
                        Cancel
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => review("verified")}>
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    Approve
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmingDecline(true)}>
                    Decline
                </Button>
            </div>
            {error !== null ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
    );
}
