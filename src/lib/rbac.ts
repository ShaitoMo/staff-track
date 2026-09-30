import { AccessTokenPayload } from '@/types/auth'
import { UpdateUserInput } from '@/types/user'
import { UserBranchService } from '@/services/user-branch-service'
import { UserService } from '@/services/user-service'
import { InsufficientRoleError } from '@/exceptions/insufficient-role-error'
import { BranchAccessDeniedError } from '@/exceptions/branch-access-denied-error'
import { ForbiddenError, SelfRoleChangeError, SelfStatusChangeError } from '@/exceptions/forbidden-error'

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

/** Throws unless the caller shares at least one of these branches. Owner is unrestricted (FR10). For a subject with no branches at all, only an owner may act on them. */
export function requireAnyBranchAccess(user: AccessTokenPayload, branchIds: number[]): void {
    if (user.role === OWNER_ROLE) {
        return
    }

    if (!branchIds.some((branchId) => user.branchIds.includes(branchId))) {
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

/** For a manager acting on someone else: the target must share at least one of the manager's branches. Owner and self are unrestricted. */
export async function requireCallerCanReachUser(caller: AccessTokenPayload, targetUserId: number): Promise<void> {
    if (caller.userId === targetUserId || caller.role === OWNER_ROLE) {
        return
    }

    const branches = await UserBranchService.getUserBranches({ userId: targetUserId })
    requireAnyBranchAccess(caller, branches.map((branch) => branch.branchId))
}

/** What requireTaskInstanceAccess needs to know about an instance — the detail view satisfies it. */
export interface TaskInstanceAccessSubject {
    completed_by: number | null
    assignee: { user_id: number } | null
    task: { branch_id: number; assigned_role_id: number | null }
}

/**
 * Throws unless the caller may access a task instance: owner (any branch), a manager of its
 * branch, or a staff member who is its named assignee, who completed it, or — for a task aimed at
 * a whole role, which has no named assignee — an active holder of that role at the branch.
 *
 * The role-holder check re-reads the user rather than trusting the token, which carries a role
 * name but no role id; it only runs when the cheaper checks have already failed.
 */
export async function requireTaskInstanceAccess(user: AccessTokenPayload, instance: TaskInstanceAccessSubject): Promise<void> {
    if (user.role === OWNER_ROLE) {
        return
    }

    if (user.role === MANAGER_ROLE) {
        requireBranchAccess(user, instance.task.branch_id)
        return
    }

    if (instance.assignee?.user_id === user.userId || instance.completed_by === user.userId) {
        return
    }

    const { assigned_role_id: roleId, branch_id: branchId } = instance.task

    if (roleId !== null && user.branchIds.includes(branchId)) {
        const caller = await UserService.getUserById(user.userId)

        if (caller?.isActive && caller.roleId === roleId) {
            return
        }
    }

    throw new ForbiddenError()
}

/**
 * PATCH /users/:userId carries a mix of self-service fields and privileged ones, so one
 * requireRole/requireSelfOrRole call can't gate the whole body — each field present is checked
 * against its own requirement, and the request is refused if any of them fails.
 */
export function requireUserUpdateAllowed(user: AccessTokenPayload, targetUserId: number, data: UpdateUserInput): void {
    if (data.roleId !== undefined) {
        requireRole(user, [OWNER_ROLE])
        if (user.userId === targetUserId) {
            throw new SelfRoleChangeError()
        }
    }

    if (data.isActive !== undefined) {
        requireRole(user, [OWNER_ROLE])
        if (user.userId === targetUserId) {
            throw new SelfStatusChangeError()
        }
    }

    if (data.name !== undefined || data.phone !== undefined) {
        requireSelfOrRole(user, targetUserId, [OWNER_ROLE, MANAGER_ROLE])
    }
}
