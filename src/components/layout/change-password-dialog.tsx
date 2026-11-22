"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { AlertCircleIcon, CircleCheckIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { changeOwnPassword } from "@/lib/api/users";
import { newPasswordErrors } from "@/lib/user-form-validation";

interface Errors {
    current?: string;
    password?: string;
    confirm?: string;
}

/**
 * Change password: the signed-in User replaces their own. A wrong current password comes back as a
 * 400 and lands under that field; the response re-issues this device's cookies, so nothing reloads.
 */
export function ChangePasswordDialog({ userId, open, onOpenChange }: { userId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
    const t = useT();
    const [current, setCurrent] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [errors, setErrors] = useState<Errors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [pending, startTransition] = useTransition();

    function handleOpenChange(next: boolean) {
        if (pending) return;
        if (next) {
            setCurrent("");
            setPassword("");
            setConfirm("");
            setErrors({});
            setSubmitError(null);
            setDone(false);
        }
        onOpenChange(next);
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);

        const found: Errors = {
            ...(current === "" ? { current: t.password.errors.currentRequired } : {}),
            ...newPasswordErrors(password, confirm, t.password.errors),
        };
        setErrors(found);
        if (Object.keys(found).length > 0) return;

        startTransition(async () => {
            try {
                await changeOwnPassword(userId, current, password);
                setDone(true);
            } catch (error) {
                // 400 here is the one rejection that belongs to a field: the current password was wrong
                if (error instanceof ApiError && error.status === 400) {
                    setErrors({ current: error.message });
                } else {
                    setSubmitError(error instanceof ApiError ? error.message : t.password.failed);
                }
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{t.password.change}</DialogTitle>
                    <DialogDescription>{t.password.changeDescription}</DialogDescription>
                </DialogHeader>
                {done ? (
                    <>
                        <p role="status" className="flex items-center gap-2 text-sm">
                            <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0 text-success" />
                            {t.password.changed}
                        </p>
                        <DialogFooter>
                            <Button onClick={() => handleOpenChange(false)}>{t.password.done}</Button>
                        </DialogFooter>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                        {submitError !== null ? (
                            <Alert variant="destructive">
                                <AlertCircleIcon />
                                <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                        ) : null}
                        <PasswordField id="current-password" label={t.password.current} autoComplete="current-password" value={current} onChange={setCurrent} error={errors.current} disabled={pending} />
                        <PasswordField id="new-password" label={t.password.new} autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} disabled={pending} />
                        <PasswordField id="confirm-password" label={t.password.confirm} autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} disabled={pending} />
                        <DialogFooter>
                            <Button type="submit" disabled={pending}>
                                {pending ? <Spinner data-icon="inline-start" /> : null}
                                {t.password.change}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** One password input with its label and error; shared by Change and Reset password. */
export function PasswordField({
    id,
    label,
    autoComplete,
    value,
    onChange,
    error,
    disabled,
}: {
    id: string;
    label: string;
    autoComplete: "current-password" | "new-password";
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled: boolean;
}) {
    return (
        <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
                id={id}
                type="password"
                autoComplete={autoComplete}
                value={value}
                disabled={disabled}
                aria-invalid={!!error || undefined}
                onChange={(event) => onChange(event.target.value)}
            />
            <FieldError>{error}</FieldError>
        </Field>
    );
}
