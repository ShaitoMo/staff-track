"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { createSection } from "@/lib/api/shelf-guide";
import { TOUCH_HEIGHT } from "@/lib/touch";
import type { SectionTypeView } from "@/types/shelf-guide";

/** Picks a section type the branch doesn't have yet. Outline when several branches stack, so the page keeps one blue button. */
export function AddSectionForm({ branchId, types, primary }: { branchId: number; types: SectionTypeView[]; primary: boolean }) {
    const router = useRouter();
    const [sectionTypeId, setSectionTypeId] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const id = `section-type-${branchId}`;

    function add() {
        setError(sectionTypeId === "" ? "Choose a section." : null);
        if (sectionTypeId === "") return;

        startTransition(async () => {
            try {
                await createSection(branchId, Number(sectionTypeId));
                setSectionTypeId("");
                router.refresh();
            } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
            }
        });
    }

    return (
        <Field data-invalid={!!error || undefined} className="max-w-lg">
            <FieldLabel htmlFor={id}>Add a section</FieldLabel>
            <div className="flex gap-2">
                <Select value={sectionTypeId} onValueChange={(value) => setSectionTypeId(String(value))} disabled={pending}>
                    <SelectTrigger id={id} className={`w-full ${TOUCH_HEIGHT}`} aria-invalid={!!error || undefined}>
                        <SelectValue placeholder="Choose a section">
                            {(value: string) => types.find((type) => String(type.sectionTypeId) === value)?.name ?? "Choose a section"}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {types.map((type) => (
                            <SelectItem key={type.sectionTypeId} value={String(type.sectionTypeId)}>
                                {type.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant={primary ? "default" : "outline"} disabled={pending} onClick={add} className={`shrink-0 ${TOUCH_HEIGHT}`}>
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    Add section
                </Button>
            </div>
            <FieldError>{error}</FieldError>
        </Field>
    );
}
