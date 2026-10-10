import { CreatePeriodSchema } from "@/types/shift-period";

/** The branch picker's value: a branch, every branch (chain-wide), or nothing picked yet. */
export type PeriodBranchChoice = number | "chain-wide" | null;

export interface PeriodFormInput {
    branch: PeriodBranchChoice;
    name: string;
    defaultStart: string;
    defaultEnd: string;
    /** As typed; empty means 0, the server's default. */
    sortOrder: string;
}

export interface PeriodFormErrors {
    branch?: string;
    name?: string;
    defaultStart?: string;
    defaultEnd?: string;
    sortOrder?: string;
}

const FIELD_MESSAGES = {
    name: "Name is required and can be at most 50 characters.",
    defaultStart: "Pick a start time.",
    defaultEnd: "Pick an end time after the start.",
} as const;

/** "" is 0; anything else must be a whole number. */
export function parseSortOrder(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    return /^-?\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Validates against CreatePeriodSchema (src/types/shift-period.ts) so the limits live in one place.
 * The branch is checked here: the schema reads a missing branch as chain-wide, but the form makes
 * that an explicit choice.
 */
export function validatePeriodForm(input: PeriodFormInput): PeriodFormErrors {
    const errors: PeriodFormErrors = {};

    if (input.branch === null) {
        errors.branch = "Pick a branch, or all branches.";
    }

    const result = CreatePeriodSchema.safeParse({
        name: input.name,
        defaultStart: input.defaultStart,
        defaultEnd: input.defaultEnd,
    });

    if (!result.success) {
        for (const issue of result.error.issues) {
            const field = issue.path[0];
            if (field === "name" || field === "defaultStart" || field === "defaultEnd") {
                errors[field] = FIELD_MESSAGES[field];
            }
        }
    }

    if (parseSortOrder(input.sortOrder) === null) {
        errors.sortOrder = "Order must be a whole number.";
    }

    return errors;
}

export function isPeriodFormValid(errors: PeriodFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
