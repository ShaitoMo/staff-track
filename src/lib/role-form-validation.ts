import { en, type Dictionary } from "@/i18n/dictionaries/en";
import { CreateRoleSchema } from "@/types/role";

export interface RoleFormErrors {
    name?: string;
}

/** Validates the trimmed name against CreateRoleSchema (src/types/role.ts) so the limits live in one place. */
export function validateRoleForm(input: { name: string }, messages: Dictionary["roles"]["errors"] = en.roles.errors): RoleFormErrors {
    return CreateRoleSchema.safeParse({ name: input.name.trim() }).success ? {} : { name: messages.name };
}

export function isRoleFormValid(errors: RoleFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
