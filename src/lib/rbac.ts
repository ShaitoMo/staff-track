import { AccessTokenPayload } from '@/types/auth'
import { InsufficientRoleError } from '@/exceptions/insufficient-role-error'
import { BranchAccessDeniedError } from '@/exceptions/branch-access-denied-error'

export const OWNER_ROLE = 'owner'
export const MANAGER_ROLE = 'manager'

/** Throws unless the caller's role is one of `roles`. */
export function requireRole(user: AccessTokenPayload, roles: string[]): void {
    if (!roles.includes(user.role)) {
        throw new InsufficientRoleError()
    }
}

/**
 * Throws unless the caller may act on this branch. Owner is unrestricted by design (FR10: "owner
 * sees all branches"); everyone else must have the branch in their own branchIds.
 */
export function requireBranchAccess(user: AccessTokenPayload, branchId: number): void {
    if (user.role === OWNER_ROLE) {
        return
    }

    if (!user.branchIds.includes(branchId)) {
        throw new BranchAccessDeniedError()
    }
}

/**
 * The users/:userId/* pattern (own shifts, own tasks, own branches, own password): the subject
 * themselves always may, and owner/manager may on anyone's behalf (FR10: "staff see only their
 * own data"). Distinct from requireRole because "it's about me" is its own bypass, not a role.
 */
export function requireSelfOrRole(user: AccessTokenPayload, targetUserId: number, roles: string[]): void {
    if (user.userId === targetUserId) {
        return
    }

    requireRole(user, roles)
}
