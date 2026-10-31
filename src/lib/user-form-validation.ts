import { en, type Dictionary } from "@/i18n/dictionaries/en";

export interface UserFormInput {
    name: string;
    phone: string;
    password?: string;
    roleId: number | null;
}

export interface UserFormErrors {
    name?: string;
    phone?: string;
    password?: string;
    roleId?: string;
}

/**
 * Mirrors UserValidateSchema/UserUpdateSchema exactly (src/types/user.ts) — no stricter rules
 * than the backend actually enforces. Notably: phone has no format constraint beyond non-empty,
 * and there is no "at least one branch" rule (the owner role legitimately has zero).
 */
export function validateUserForm(
    input: UserFormInput,
    options: { requirePassword: boolean },
    messages: Dictionary["users"]["errors"] = en.users.errors,
): UserFormErrors {
    const errors: UserFormErrors = {};

    if (input.name.length < 3 || input.name.length > 50) {
        errors.name = messages.name;
    }

    if (input.phone.length < 1) {
        errors.phone = messages.phone;
    }

    if (options.requirePassword) {
        if (!input.password || input.password.length < 8 || input.password.length > 100) {
            errors.password = messages.password;
        }
    }

    if (input.roleId === null) {
        errors.roleId = messages.roleId;
    }

    return errors;
}

export function isUserFormValid(errors: UserFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
