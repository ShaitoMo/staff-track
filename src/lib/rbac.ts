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

/** Throws unless the caller may act on this branch. Owner is unrestricted (FR10); everyone else needs it in their own branchIds. */
export function requireBranchAccess(user: AccessTokenPayload, branchId: number): void {
    if (user.role === OWNER_ROLE) {
        return
    }

    if (!user.branchIds.includes(branchId)) {
        throw new BranchAccessDeniedError()
    }
}

/** For users/:userId/* routes: the subject themselves always may; owner/manager may on anyone's behalf. */
export function requireSelfOrRole(user: AccessTokenPayload, targetUserId: number, roles: string[]): void {
    if (user.userId === targetUserId) {
        return
    }

    requireRole(user, roles)
}
