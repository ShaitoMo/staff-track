import { AccessTokenPayload } from '@/types/auth'
import { UpdateUserInput } from '@/types/user'
import { InsufficientRoleError } from '@/exceptions/insufficient-role-error'
import { BranchAccessDeniedError } from '@/exceptions/branch-access-denied-error'
import { ForbiddenError, SelfRoleChangeError } from '@/exceptions/forbidden-error'

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

/**
 * Throws unless the caller shares at least one branch with the target user. Owner is
 * unrestricted (FR10). A target with no branch links (e.g. the owner account itself)
 * can therefore only be acted on by the owner.
 */
export function requireSharedBranchWithUser(user: AccessTokenPayload, targetBranchIds: number[]): void {
    if (user.role === OWNER_ROLE) {
        return
    }

    if (!targetBranchIds.some((branchId) => user.branchIds.includes(branchId))) {
        throw new BranchAccessDeniedError()
    }
}

/**
 * Throws unless the caller may access a task instance at `branchId`: owner (any branch), a
 * manager of that branch, or the instance's own assignee.
 */
export function requireTaskInstanceAccess(user: AccessTokenPayload, branchId: number, assigneeUserId?: number | null): void {
    if (user.role === OWNER_ROLE) {
        return
    }

    if (user.role === MANAGER_ROLE) {
        requireBranchAccess(user, branchId)
        return
    }

    if (assigneeUserId !== user.userId) {
        throw new ForbiddenError()
    }
}

/**
 * PATCH /users/:userId carries a mix of self-service fields and privileged ones, so one
 * requireRole/requireSelfOrRole call can't gate the whole body — each field present is checked
 * against its own requirement, and the request is refused if any of them fails.
 */
export function requireUserUpdateAllowed(user: AccessTokenPayload, targetUserId: number, data: UpdateUserInput): void {
    if (data.roleId !== undefined) {
        if (user.userId === targetUserId) {
            throw new SelfRoleChangeError()
        }
        requireRole(user, [OWNER_ROLE])
    }

    if (data.isActive !== undefined) {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
    }

    if (data.name !== undefined || data.phone !== undefined) {
        requireSelfOrRole(user, targetUserId, [OWNER_ROLE, MANAGER_ROLE])
    }
}
