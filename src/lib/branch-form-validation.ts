export interface BranchFormInput {
    name: string;
    location: string;
}

export interface BranchFormErrors {
    name?: string;
    location?: string;
}

/**
 * Mirrors CreateBranchSchema/BranchUpdateSchema (src/types/branch.ts). Location is optional, but the
 * update schema has no way to clear it, so a location that was already set can't be blanked on edit.
 */
export function validateBranchForm(input: BranchFormInput, options: { hadLocation: boolean }): BranchFormErrors {
    const errors: BranchFormErrors = {};

    if (input.name.length < 3 || input.name.length > 50) {
        errors.name = "Name must be between 3 and 50 characters.";
    }

    if (input.location.length === 0) {
        if (options.hadLocation) {
            errors.location = "Location can't be cleared once set.";
        }
    } else if (input.location.length < 3 || input.location.length > 100) {
        errors.location = "Location must be between 3 and 100 characters.";
    }

    return errors;
}

export function isBranchFormValid(errors: BranchFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
