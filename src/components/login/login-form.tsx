"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, login } from "@/lib/api-client";

export function LoginForm() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setPending(true);

        try {
            await login({ phone, password });
            router.push("/");
            router.refresh();
        } catch (error) {
            setError(error instanceof ApiError && error.message ? error.message : "Invalid phone or password.");
        } finally {
            setPending(false);
        }
    }

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>StaffTrack</CardTitle>
                <CardDescription>Sign in with your phone number and password.</CardDescription>
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
                        <Field>
                            <FieldLabel htmlFor="phone">Phone</FieldLabel>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                autoComplete="tel"
                                required
                                disabled={pending}
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="password">Password</FieldLabel>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                disabled={pending}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                        </Field>
                        <Button type="submit" disabled={pending} className="w-full">
                            {pending && <Spinner data-icon="inline-start" />}
                            Sign in
                        </Button>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
