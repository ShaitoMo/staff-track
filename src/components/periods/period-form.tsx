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
import { useT } from "@/i18n/client";
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

/** Each field's control id, in reading order: the first one with an error takes focus on submit. */
const FIELD_IDS: Record<keyof PeriodFormErrors, string> = {
    branch: "branch",
    name: "name",
    defaultStart: "default-start",
    defaultEnd: "default-end",
    sortOrder: "sort-order",
};

/** Marks a control invalid and points it at its error, so a screen reader reads both on focus. */
function invalidProps(errors: PeriodFormErrors, field: keyof PeriodFormErrors, describedBy?: string) {
    const error = errors[field];
    const ids = [describedBy, error ? `${FIELD_IDS[field]}-error` : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": !!error || undefined, "aria-describedby": ids || undefined };
}

interface PeriodFormProps {
    mode: "create" | "edit";
    branches: Branch[];
    /** Only the owner may create a chain-wide period, so only they are offered it. */
    canPickChainWide: boolean;
    /** The branch the switcher has selected, so a new period starts there. */
    defaultBranchId?: number;
    periodId?: number;
    initialValues?: {
        branch: PeriodBranchChoice;
        name: string;
        defaultStart: string;
        defaultEnd: string;
        sortOrder: number;
    };
}

export function PeriodForm({ mode, branches, canPickChainWide, defaultBranchId, periodId, initialValues }: PeriodFormProps) {
    const router = useRouter();
    const [branch, setBranch] = useState<PeriodBranchChoice>(initialValues?.branch ?? defaultBranchId ?? null);
    const [name, setName] = useState(initialValues?.name ?? "");
    const [defaultStart, setDefaultStart] = useState(initialValues?.defaultStart ?? "");
    const [defaultEnd, setDefaultEnd] = useState(initialValues?.defaultEnd ?? "");
    const [sortOrder, setSortOrder] = useState(initialValues ? String(initialValues.sortOrder) : "");
    const [errors, setErrors] = useState<PeriodFormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const t = useT();

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);

        const validationErrors = validatePeriodForm({ branch, name, defaultStart, defaultEnd, sortOrder }, t.periods.errors);
        setErrors(validationErrors);
        if (!isPeriodFormValid(validationErrors)) {
            const first = (Object.keys(FIELD_IDS) as (keyof PeriodFormErrors)[]).find((field) => validationErrors[field]);
            if (first) document.getElementById(FIELD_IDS[first])?.focus();
            return;
        }

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
                setSubmitError(error instanceof ApiError ? error.message : t.common.somethingWentWrong);
            }
        });
    }

    const branchLabel = (value: string) =>
        value === CHAIN_WIDE
            ? t.periods.allBranches
            : branches.find((option) => String(option.branchId) === value)?.name ?? t.setup.selectBranch;

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

            <FormSection legend={t.setup.details} className="sm:grid-cols-2">
                <Field data-invalid={!!errors.branch || undefined}>
                    <FieldLabel htmlFor="branch">{t.setup.branch}</FieldLabel>
                    <Select
                        value={branch === null ? "" : String(branch)}
                        onValueChange={(value) => setBranch(value === CHAIN_WIDE ? CHAIN_WIDE : Number(value))}
                        disabled={pending || mode === "edit"}
                    >
                        <SelectTrigger id="branch" className="w-full" {...invalidProps(errors, "branch")}>
                            <SelectValue placeholder={t.setup.selectBranch}>{branchLabel}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {canPickChainWide || branch === CHAIN_WIDE ? (
                                <SelectItem value={CHAIN_WIDE}>{t.periods.allBranches}</SelectItem>
                            ) : null}
                            {branches.map((option) => (
                                <SelectItem key={option.branchId} value={String(option.branchId)}>
                                    {option.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError id="branch-error">{errors.branch}</FieldError>
                </Field>

                <Field data-invalid={!!errors.name || undefined}>
                    <FieldLabel htmlFor="name">{t.setup.name}</FieldLabel>
                    <Input
                        id="name"
                        value={name}
                        maxLength={50}
                        disabled={pending}
                        onChange={(e) => setName(e.target.value)}
                        {...invalidProps(errors, "name")}
                    />
                    <FieldError id="name-error">{errors.name}</FieldError>
                </Field>
            </FormSection>

            <FormSection legend={t.periods.hours} className="sm:grid-cols-3">
                <Field data-invalid={!!errors.defaultStart || undefined}>
                    <FieldLabel htmlFor="default-start">{t.periods.starts}</FieldLabel>
                    <Input
                        id="default-start"
                        type="time"
                        value={defaultStart}
                        disabled={pending}
                        onChange={(e) => setDefaultStart(e.target.value)}
                        {...invalidProps(errors, "defaultStart")}
                    />
                    <FieldError id="default-start-error">{errors.defaultStart}</FieldError>
                </Field>

                <Field data-invalid={!!errors.defaultEnd || undefined}>
                    <FieldLabel htmlFor="default-end">{t.periods.ends}</FieldLabel>
                    <Input
                        id="default-end"
                        type="time"
                        value={defaultEnd}
                        disabled={pending}
                        onChange={(e) => setDefaultEnd(e.target.value)}
                        {...invalidProps(errors, "defaultEnd")}
                    />
                    <FieldError id="default-end-error">{errors.defaultEnd}</FieldError>
                </Field>

                <Field data-invalid={!!errors.sortOrder || undefined}>
                    <FieldLabel htmlFor="sort-order">{t.periods.order}</FieldLabel>
                    <Input
                        id="sort-order"
                        inputMode="numeric"
                        placeholder="0"
                        value={sortOrder}
                        disabled={pending}
                        onChange={(e) => setSortOrder(e.target.value)}
                        {...invalidProps(errors, "sortOrder", "sort-order-description")}
                    />
                    <FieldDescription id="sort-order-description">{t.periods.orderHint}</FieldDescription>
                    <FieldError id="sort-order-error">{errors.sortOrder}</FieldError>
                </Field>
            </FormSection>

            <FormFooter>
                <Button type="submit" disabled={pending}>
                    {pending && <Spinner data-icon="inline-start" />}
                    {mode === "create" ? t.periods.createPeriod : t.setup.saveChanges}
                </Button>
            </FormFooter>
        </FormCard>
    );
}
