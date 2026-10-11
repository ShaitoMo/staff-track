import { CreateRoleSchema } from "@/types/role";

export interface RoleFormErrors {
    name?: string;
}

const NAME_MESSAGE = "Name must be 3 to 50 characters.";

/** Validates the trimmed name against CreateRoleSchema (src/types/role.ts) so the limits live in one place. */
export function validateRoleForm(input: { name: string }): RoleFormErrors {
    return CreateRoleSchema.safeParse({ name: input.name.trim() }).success ? {} : { name: NAME_MESSAGE };
}

export function isRoleFormValid(errors: RoleFormErrors): boolean {
    return Object.keys(errors).length === 0;
}
