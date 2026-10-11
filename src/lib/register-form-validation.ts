import { CreateRegisterSchema } from "@/types/register";

export interface RegisterFormInput {
    branchId: number | null;
    name: string;
}

export interface RegisterFormErrors {
    branchId?: string;
    name?: string;
}

const FIELD_MESSAGES = {
    branchId: "Branch is required.",
    name: "Name is required and can be at most 50 characters.",
} as const;

/** Validates against CreateRegisterSchema (src/types/register.ts) so the limits live in one place. */
export function validateRegisterForm(input: RegisterFormInput): RegisterFormErrors {
    const errors: RegisterFormErrors = {};

    const result = CreateRegisterSchema.safeParse({
        branchId: input.branchId ?? undefined,
        name: input.name,
    });

    if (!result.success) {
        for (const issue of result.error.issues) {
            const field = issue.path[0];
            if (field === "branchId" || field === "name") {
                errors[field] = FIELD_MESSAGES[field];
            }
        }
    }

    return errors;
}

export function isRegisterFormValid(errors: RegisterFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
