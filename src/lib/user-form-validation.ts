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
export function validateUserForm(input: UserFormInput, options: { requirePassword: boolean }): UserFormErrors {
    const errors: UserFormErrors = {};

    if (input.name.length < 3 || input.name.length > 50) {
        errors.name = "Name must be between 3 and 50 characters.";
    }

    if (input.phone.length < 1) {
        errors.phone = "Phone is required.";
    }

    if (options.requirePassword) {
        if (!input.password || input.password.length < 8 || input.password.length > 100) {
            errors.password = "Password must be between 8 and 100 characters.";
        }
    }

    if (input.roleId === null) {
        errors.roleId = "Role is required.";
    }

    return errors;
}

export function isUserFormValid(errors: UserFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
