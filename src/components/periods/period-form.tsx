"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { FormAlerts, FormCard, FormFooter, FormSection } from "@/components/layout/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { createPeriod, updatePeriod } from "@/lib/api/periods";
import {
    isPeriodFormValid,
    parseSortOrder,
    PeriodBranchChoice,
    PeriodFormErrors,
    validatePeriodForm,
} from "@/lib/period-form-validation";
import { Branch } from "@/types/branch";

const CHAIN_WIDE = "chain-wide";

interface PeriodFormProps {
    mode: "create" | "edit";
    branches: Branch[];
    /** Only the owner may create a chain-wide period, so only they are offered it. */
    canPickChainWide: boolean;
    periodId?: number;
    initialValues?: {
        branch: PeriodBranchChoice;
        name: string;
        defaultStart: string;
        defaultEnd: string;
        sortOrder: number;
    };
}

export function PeriodForm({ mode, branches, canPickChainWide, periodId, initialValues }: PeriodFormProps) {
    const router = useRouter();
    const [branch, setBranch] = useState<PeriodBranchChoice>(initialValues?.branch ?? null);
    const [name, setName] = useState(initialValues?.name ?? "");
    const [defaultStart, setDefaultStart] = useState(initialValues?.defaultStart ?? "");
    const [defaultEnd, setDefaultEnd] = useState(initialValues?.defaultEnd ?? "");
    const [sortOrder, setSortOrder] = useState(initialValues ? String(initialValues.sortOrder) : "");
    const [errors, setErrors] = useState<PeriodFormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);

        const validationErrors = validatePeriodForm({ branch, name, defaultStart, defaultEnd, sortOrder });
        setErrors(validationErrors);
        if (!isPeriodFormValid(validationErrors)) return;

        const fields = { name, defaultStart, defaultEnd, sortOrder: parseSortOrder(sortOrder)! };

        startTransition(async () => {
            try {
                if (mode === "create") {
                    await createPeriod({ branchId: branch === CHAIN_WIDE ? null : branch, ...fields });
                } else {
                    await updatePeriod(periodId!, fields);
                }

                router.push("/periods");
                router.refresh();
            } catch (error) {
                setSubmitError(error instanceof ApiError ? error.message : "Something went wrong.");
            }
        });
    }

    const branchLabel = (value: string) =>
        value === CHAIN_WIDE
            ? "All branches"
            : branches.find((option) => String(option.branchId) === value)?.name ?? "Select a branch";

    return (
        <FormCard onSubmit={handleSubmit} className="max-w-3xl">
            {submitError && (
                <FormAlerts>
                    <Alert variant="destructive">
                        <AlertCircleIcon />
                        <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                </FormAlerts>
            )}

            <FormSection legend="Details" className="sm:grid-cols-2">
                <Field data-invalid={!!errors.branch || undefined}>
                    <FieldLabel htmlFor="branch">Branch</FieldLabel>
                    <Select
                        value={branch === null ? "" : String(branch)}
                        onValueChange={(value) => setBranch(value === CHAIN_WIDE ? CHAIN_WIDE : Number(value))}
                        disabled={pending || mode === "edit"}
                    >
                        <SelectTrigger id="branch" className="w-full">
                            <SelectValue placeholder="Select a branch">{branchLabel}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {canPickChainWide || branch === CHAIN_WIDE ? (
                                <SelectItem value={CHAIN_WIDE}>All branches</SelectItem>
                            ) : null}
                            {branches.map((option) => (
                                <SelectItem key={option.branchId} value={String(option.branchId)}>
                                    {option.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError>{errors.branch}</FieldError>
                </Field>

                <Field data-invalid={!!errors.name || undefined}>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input id="name" value={name} disabled={pending} onChange={(e) => setName(e.target.value)} />
                    <FieldError>{errors.name}</FieldError>
                </Field>
            </FormSection>

            <FormSection legend="Hours" className="sm:grid-cols-3">
                <Field data-invalid={!!errors.defaultStart || undefined}>
                    <FieldLabel htmlFor="default-start">Starts</FieldLabel>
                    <Input
                        id="default-start"
                        type="time"
                        value={defaultStart}
                        disabled={pending}
                        onChange={(e) => setDefaultStart(e.target.value)}
                    />
                    <FieldError>{errors.defaultStart}</FieldError>
                </Field>

                <Field data-invalid={!!errors.defaultEnd || undefined}>
                    <FieldLabel htmlFor="default-end">Ends</FieldLabel>
                    <Input
                        id="default-end"
                        type="time"
                        value={defaultEnd}
                        disabled={pending}
                        onChange={(e) => setDefaultEnd(e.target.value)}
                    />
                    <FieldError>{errors.defaultEnd}</FieldError>
                </Field>

                <Field data-invalid={!!errors.sortOrder || undefined}>
                    <FieldLabel htmlFor="sort-order">Order</FieldLabel>
                    <Input
                        id="sort-order"
                        inputMode="numeric"
                        placeholder="0"
                        value={sortOrder}
                        disabled={pending}
                        onChange={(e) => setSortOrder(e.target.value)}
                    />
                    <FieldDescription>Lower comes first on the schedule.</FieldDescription>
                    <FieldError>{errors.sortOrder}</FieldError>
                </Field>
            </FormSection>

            <FormFooter>
                <Button type="submit" disabled={pending}>
                    {pending && <Spinner data-icon="inline-start" />}
                    {mode === "create" ? "Create period" : "Save changes"}
                </Button>
            </FormFooter>
        </FormCard>
    );
}
