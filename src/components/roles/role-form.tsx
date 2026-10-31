"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { createRole } from "@/lib/api/roles";
import { isRoleFormValid, RoleFormErrors, validateRoleForm } from "@/lib/role-form-validation";

export function RoleForm() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [errors, setErrors] = useState<RoleFormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const t = useT();

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);

        const validationErrors = validateRoleForm({ name }, t.roles.errors);
        setErrors(validationErrors);
        if (!isRoleFormValid(validationErrors)) return;

        startTransition(async () => {
            try {
                await createRole({ name: name.trim() });
                setName("");
                router.refresh();
            } catch (error) {
                setSubmitError(error instanceof ApiError ? error.message : t.common.somethingWentWrong);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="flex max-w-lg flex-col gap-3">
            {submitError ? (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{submitError}</AlertDescription>
                </Alert>
            ) : null}
            <Field data-invalid={!!errors.name || undefined}>
                <FieldLabel htmlFor="role-name">{t.roles.newRole}</FieldLabel>
                <div className="flex gap-2">
                    <Input
                        id="role-name"
                        value={name}
                        disabled={pending}
                        aria-invalid={!!errors.name || undefined}
                        onChange={(event) => setName(event.target.value)}
                    />
                    <Button type="submit" disabled={pending} className="shrink-0">
                        {pending ? <Spinner data-icon="inline-start" /> : null}
                        {t.roles.addRole}
                    </Button>
                </div>
                <FieldError>{errors.name}</FieldError>
            </Field>
        </form>
    );
}
