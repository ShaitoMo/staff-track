import { CreateBranchSchema } from "@/types/branch";

export interface BranchFormInput {
    name: string;
    location: string;
}

export interface BranchFormErrors {
    name?: string;
    location?: string;
}

const FIELD_MESSAGES = {
    name: "Name must be between 3 and 50 characters.",
    location: "Location must be between 3 and 100 characters.",
} as const;

/**
 * Validates against CreateBranchSchema (src/types/branch.ts) so the limits live in one place. The one
 * rule the schema can't express: its update variant has no way to clear a location, so a location
 * that was already set can't be blanked on edit.
 */
export function validateBranchForm(input: BranchFormInput, options: { hadLocation: boolean }): BranchFormErrors {
    const errors: BranchFormErrors = {};

    const result = CreateBranchSchema.safeParse({
        name: input.name,
        location: input.location || undefined,
    });

    if (!result.success) {
        for (const issue of result.error.issues) {
            const field = issue.path[0];
            if (field === "name" || field === "location") {
                errors[field] = FIELD_MESSAGES[field];
            }
        }
    }

    if (input.location.length === 0 && options.hadLocation) {
        errors.location = "Location can't be cleared once set.";
    }

    return errors;
}

export function isBranchFormValid(errors: BranchFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
