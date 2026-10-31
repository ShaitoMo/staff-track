import { en, type Dictionary } from "@/i18n/dictionaries/en";
import { CreateBranchSchema } from "@/types/branch";

export interface BranchFormInput {
    name: string;
    location: string;
}

export interface BranchFormErrors {
    name?: string;
    location?: string;
}

/**
 * Validates against CreateBranchSchema (src/types/branch.ts) so the limits live in one place. The one
 * rule the schema can't express: its update variant has no way to clear a location, so a location
 * that was already set can't be blanked on edit.
 */
export function validateBranchForm(
    input: BranchFormInput,
    options: { hadLocation: boolean },
    messages: Dictionary["branches"]["errors"] = en.branches.errors,
): BranchFormErrors {
    const errors: BranchFormErrors = {};

    const result = CreateBranchSchema.safeParse({
        name: input.name,
        location: input.location || undefined,
    });

    if (!result.success) {
        for (const issue of result.error.issues) {
            const field = issue.path[0];
            if (field === "name" || field === "location") {
                errors[field] = messages[field];
            }
        }
    }

    if (input.location.length === 0 && options.hadLocation) {
        errors.location = messages.locationCleared;
    }

    return errors;
}

export function isBranchFormValid(errors: BranchFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
