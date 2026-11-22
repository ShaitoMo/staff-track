"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { AlertCircleIcon, CircleCheckIcon } from "lucide-react";
import { FormAlerts, FormCard, FormFooter, FormSection } from "@/components/layout/form-card";
import { PasswordField } from "@/components/layout/change-password-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { resetPassword } from "@/lib/api/users";
import { newPasswordErrors } from "@/lib/user-form-validation";

/**
 * Reset password, on Edit user: its own card with its own button, so saving a name never touches the
 * password. Outline, not primary: the user form above already holds this page's one blue button.
 */
export function ResetPasswordForm({ userId, name }: { userId: number; name: string }) {
    const t = useT();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [pending, startTransition] = useTransition();

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);
        setDone(false);

        const found = newPasswordErrors(password, confirm, t.password.errors);
        setErrors(found);
        if (Object.keys(found).length > 0) return;

        startTransition(async () => {
            try {
                await resetPassword(userId, password);
                setPassword("");
                setConfirm("");
                setDone(true);
            } catch (error) {
                setSubmitError(error instanceof ApiError ? error.message : t.password.failed);
            }
        });
    }

    return (
        <FormCard onSubmit={handleSubmit} className="max-w-5xl">
            {submitError !== null || done ? (
                <FormAlerts>
                    {submitError !== null ? (
                        <Alert variant="destructive">
                            <AlertCircleIcon />
                            <AlertDescription>{submitError}</AlertDescription>
                        </Alert>
                    ) : (
                        <p role="status" className="flex items-center gap-2 text-sm">
                            <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0 text-success" />
                            {t.password.resetDone(name)}
                        </p>
                    )}
                </FormAlerts>
            ) : null}
            <FormSection legend={t.password.resetLegend} className="md:grid-cols-2">
                <FieldDescription className="md:col-span-2">{t.password.resetDescription(name)}</FieldDescription>
                <PasswordField id="reset-password" label={t.password.new} autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} disabled={pending} />
                <PasswordField id="reset-confirm" label={t.password.confirm} autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} disabled={pending} />
            </FormSection>
            <FormFooter>
                <Button type="submit" variant="outline" disabled={pending}>
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    {t.password.reset}
                </Button>
            </FormFooter>
        </FormCard>
    );
}
