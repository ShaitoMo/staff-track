"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
