"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError, login } from "@/lib/api-client";
import { LoginSchema, type LoginInput } from "@/types/auth";

type FieldErrors = Partial<Record<keyof LoginInput, string[]>>;

export function LoginForm() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [pending, startTransition] = useTransition();
    const t = useT();

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const result = LoginSchema.safeParse({ phone, password });
        if (!result.success) {
            setFieldErrors(z.flattenError(result.error).fieldErrors);
            return;
        }
        setFieldErrors({});

        startTransition(async () => {
            try {
                await login(result.data);
                router.push("/");
                router.refresh();
            } catch (error) {
                // a wrong phone or password is the one server reply everyone sees, so it's worded here in both languages
                setError(error instanceof ApiError && error.status !== 401 && error.message ? error.message : t.login.invalidCredentials);
            }
        });
    }

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>{t.common.appName}</CardTitle>
                <CardDescription>{t.login.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} noValidate>
                    <FieldGroup>
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircleIcon />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <Field data-invalid={!!fieldErrors.phone}>
                            <FieldLabel htmlFor="phone">{t.login.phone}</FieldLabel>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                dir="ltr"
                                autoComplete="tel"
                                required
                                aria-invalid={!!fieldErrors.phone}
                                disabled={pending}
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                            />
                            <FieldError>{fieldErrors.phone ? t.login.phoneRequired : null}</FieldError>
                        </Field>
                        <Field data-invalid={!!fieldErrors.password}>
                            <FieldLabel htmlFor="password">{t.login.password}</FieldLabel>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                aria-invalid={!!fieldErrors.password}
                                disabled={pending}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                            <FieldError>{fieldErrors.password ? t.login.passwordRequired : null}</FieldError>
                        </Field>
                        <Button type="submit" disabled={pending} className="w-full">
                            {pending && <Spinner data-icon="inline-start" />}
                            {t.login.signIn}
                        </Button>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
