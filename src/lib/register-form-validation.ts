import { en, type Dictionary } from "@/i18n/dictionaries/en";
import { CreateRegisterSchema } from "@/types/register";

export interface RegisterFormInput {
    branchId: number | null;
    name: string;
}

export interface RegisterFormErrors {
    branchId?: string;
    name?: string;
}

/** Validates against CreateRegisterSchema (src/types/register.ts) so the limits live in one place. */
export function validateRegisterForm(
    input: RegisterFormInput,
    messages: Dictionary["registers"]["errors"] = en.registers.errors,
): RegisterFormErrors {
    const errors: RegisterFormErrors = {};

    const result = CreateRegisterSchema.safeParse({
        branchId: input.branchId ?? undefined,
        name: input.name,
    });

    if (!result.success) {
        for (const issue of result.error.issues) {
            const field = issue.path[0];
            if (field === "branchId" || field === "name") {
                errors[field] = messages[field];
            }
        }
    }

    return errors;
}

export function isRegisterFormValid(errors: RegisterFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
