"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { TOUCH_HEIGHT } from "@/lib/touch";

/** One name and one button that adds a row to the list beside it (new folder, new section type), like "New role". */
export function InlineNameForm({
    id,
    label,
    submitLabel,
    maxLength,
    primary = false,
    onSubmit,
}: {
    id: string;
    label: string;
    submitLabel: string;
    maxLength: number;
    primary?: boolean;
    onSubmit: (name: string) => Promise<void>;
}) {
    const router = useRouter();
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const t = useT();

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = name.trim();
        setError(trimmed === "" ? t.guide.enterName : null);
        if (trimmed === "") return;

        startTransition(async () => {
            try {
                await onSubmit(trimmed);
                setName("");
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.common.somethingWentWrong);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="max-w-lg">
            <Field data-invalid={!!error || undefined}>
                <FieldLabel htmlFor={id}>{label}</FieldLabel>
                <div className="flex gap-2">
                    <Input
                        id={id}
                        value={name}
                        maxLength={maxLength}
                        disabled={pending}
                        aria-invalid={!!error || undefined}
                        className={TOUCH_HEIGHT}
                        onChange={(event) => setName(event.target.value)}
                    />
                    <Button type="submit" variant={primary ? "default" : "outline"} disabled={pending} className={`shrink-0 ${TOUCH_HEIGHT}`}>
                        {pending ? <Spinner data-icon="inline-start" /> : null}
                        {submitLabel}
                    </Button>
                </div>
                <FieldError>{error}</FieldError>
            </Field>
        </form>
    );
}
