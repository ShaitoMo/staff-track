"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { FormAlerts, FormCard, FormFooter, FormSection } from "@/components/layout/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { createBranch, updateBranch } from "@/lib/api/branches";
import { BranchFormErrors, isBranchFormValid, validateBranchForm } from "@/lib/branch-form-validation";
import type { BranchUpdateInput } from "@/types/branch";

interface BranchFormProps {
    mode: "create" | "edit";
    branchId?: number;
    initialValues?: {
        name: string;
        location?: string;
    };
}

export function BranchForm({ mode, branchId, initialValues }: BranchFormProps) {
    const router = useRouter();
    const [name, setName] = useState(initialValues?.name ?? "");
    const [location, setLocation] = useState(initialValues?.location ?? "");
    const [errors, setErrors] = useState<BranchFormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);
        setNotice(null);

        const validationErrors = validateBranchForm(
            { name, location },
            { hadLocation: !!initialValues?.location },
        );
        setErrors(validationErrors);
        if (!isBranchFormValid(validationErrors)) return;

        startTransition(async () => {
            try {
                if (mode === "create") {
                    await createBranch({ name, location: location || undefined });
                } else {
                    const patch: BranchUpdateInput = {};
                    if (name !== initialValues?.name) patch.name = name;
                    if (location && location !== initialValues?.location) patch.location = location;

                    if (Object.keys(patch).length === 0) {
                        setNotice("No changes to save.");
                        return;
                    }
                    await updateBranch(branchId!, patch);
                }

                router.push("/branches");
                router.refresh();
            } catch (error) {
                setSubmitError(error instanceof ApiError ? error.message : "Something went wrong.");
            }
        });
    }

    return (
        <FormCard onSubmit={handleSubmit} className="max-w-3xl">
            {submitError || notice ? (
                <FormAlerts>
                    {submitError && (
                        <Alert variant="destructive">
                            <AlertCircleIcon />
                            <AlertDescription>{submitError}</AlertDescription>
                        </Alert>
                    )}
                    {notice && (
                        <Alert role="status">
                            <AlertDescription>{notice}</AlertDescription>
                        </Alert>
                    )}
                </FormAlerts>
            ) : null}

            <FormSection legend="Details" className="sm:grid-cols-2">
                <Field data-invalid={!!errors.name || undefined}>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input
                        id="name"
                        value={name}
                        disabled={pending}
                        aria-invalid={!!errors.name || undefined}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <FieldError>{errors.name}</FieldError>
                </Field>

                <Field data-invalid={!!errors.location || undefined}>
                    <FieldLabel htmlFor="location">Location (optional)</FieldLabel>
                    <Input
                        id="location"
                        value={location}
                        disabled={pending}
                        aria-invalid={!!errors.location || undefined}
                        onChange={(e) => setLocation(e.target.value)}
                    />
                    <FieldError>{errors.location}</FieldError>
                </Field>
            </FormSection>

            <FormFooter>
                <Button type="submit" disabled={pending}>
                    {pending && <Spinner data-icon="inline-start" />}
                    {mode === "create" ? "Create branch" : "Save changes"}
                </Button>
            </FormFooter>
        </FormCard>
    );
}
