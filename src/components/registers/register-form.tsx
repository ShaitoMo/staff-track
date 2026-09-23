"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { createRegister, updateRegister } from "@/lib/api/registers";
import { isRegisterFormValid, RegisterFormErrors, validateRegisterForm } from "@/lib/register-form-validation";
import { Branch } from "@/types/branch";

interface RegisterFormProps {
    mode: "create" | "edit";
    branches: Branch[];
    registerId?: number;
    initialValues?: {
        branchId: number;
        name: string;
    };
}

export function RegisterForm({ mode, branches, registerId, initialValues }: RegisterFormProps) {
    const router = useRouter();
    const [branchId, setBranchId] = useState<number | null>(initialValues?.branchId ?? null);
    const [name, setName] = useState(initialValues?.name ?? "");
    const [errors, setErrors] = useState<RegisterFormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);

        const validationErrors = validateRegisterForm({ branchId, name });
        setErrors(validationErrors);
        if (!isRegisterFormValid(validationErrors)) return;

        setPending(true);
        try {
            if (mode === "create") {
                await createRegister({ branchId: branchId!, name });
            } else if (name !== initialValues?.name) {
                await updateRegister(registerId!, { name });
            }

            router.push("/registers");
            router.refresh();
        } catch (error) {
            setSubmitError(error instanceof ApiError ? error.message : "Something went wrong.");
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="flex max-w-lg flex-col gap-6">
            <FieldGroup>
                {submitError && (
                    <Alert variant="destructive">
                        <AlertCircleIcon />
                        <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                )}

                <Field data-invalid={!!errors.branchId || undefined}>
                    <FieldLabel htmlFor="branch">Branch</FieldLabel>
                    <Select
                        value={branchId !== null ? String(branchId) : ""}
                        onValueChange={(value) => setBranchId(Number(value))}
                        disabled={pending || mode === "edit"}
                    >
                        <SelectTrigger id="branch" className="w-full">
                            <SelectValue placeholder="Select a branch">
                                {(value: string) => branches.find((branch) => String(branch.branchId) === value)?.name ?? "Select a branch"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {branches.map((branch) => (
                                <SelectItem key={branch.branchId} value={String(branch.branchId)}>
                                    {branch.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError>{errors.branchId}</FieldError>
                </Field>

                <Field data-invalid={!!errors.name || undefined}>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input id="name" value={name} disabled={pending} onChange={(e) => setName(e.target.value)} />
                    <FieldError>{errors.name}</FieldError>
                </Field>

                <Button type="submit" disabled={pending} className="w-fit">
                    {pending && <Spinner data-icon="inline-start" />}
                    {mode === "create" ? "Create register" : "Save changes"}
                </Button>
            </FieldGroup>
        </form>
    );
}
