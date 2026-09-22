import {
    MANAGER_ROLE,
    OWNER_ROLE,
    requireAnyBranchAccess,
    requireBranchAccess,
    requireRole,
    requireSelfOrRole,
    requireTaskInstanceAccess,
} from '@/lib/rbac'
import { InsufficientRoleError } from '@/exceptions/insufficient-role-error'
import { BranchAccessDeniedError } from '@/exceptions/branch-access-denied-error'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { AccessTokenPayload } from '@/types/auth'

function user(overrides: Partial<AccessTokenPayload> = {}): AccessTokenPayload {
    return { userId: 1, role: MANAGER_ROLE, branchIds: [1], ...overrides }
}

describe('requireRole', () => {
    it('allows a caller whose role is listed', () => {
        expect(() => requireRole(user({ role: OWNER_ROLE }), [OWNER_ROLE])).not.toThrow()
    })

    it('throws for a caller whose role is not listed', () => {
        expect(() => requireRole(user({ role: 'staff' }), [OWNER_ROLE, MANAGER_ROLE])).toThrow(InsufficientRoleError)
    })
})

describe('requireBranchAccess', () => {
    it('lets the owner through regardless of branch', () => {
        expect(() => requireBranchAccess(user({ role: OWNER_ROLE, branchIds: [] }), 99)).not.toThrow()
    })

    it('lets a manager through for a branch they belong to', () => {
        expect(() => requireBranchAccess(user({ branchIds: [1, 2] }), 2)).not.toThrow()
    })

    it('blocks a manager from a branch they do not belong to', () => {
        expect(() => requireBranchAccess(user({ branchIds: [1] }), 2)).toThrow(BranchAccessDeniedError)
    })
})

describe('requireSelfOrRole', () => {
    it('lets the subject act on themselves with no role at all', () => {
        expect(() => requireSelfOrRole(user({ userId: 5, role: 'staff' }), 5, [OWNER_ROLE, MANAGER_ROLE])).not.toThrow()
    })

    it('falls back to requireRole for anyone else', () => {
        expect(() => requireSelfOrRole(user({ userId: 5, role: 'staff' }), 6, [OWNER_ROLE, MANAGER_ROLE])).toThrow(InsufficientRoleError)
    })
})

describe('requireAnyBranchAccess', () => {
    it('lets the owner through regardless of the target branches', () => {
        expect(() => requireAnyBranchAccess(user({ role: OWNER_ROLE, branchIds: [] }), [7])).not.toThrow()
    })

    it('lets a manager through when they share a branch with the target', () => {
        expect(() => requireAnyBranchAccess(user({ branchIds: [1, 2] }), [2, 3])).not.toThrow()
    })

    it('blocks a manager from a target at a different branch', () => {
        expect(() => requireAnyBranchAccess(user({ branchIds: [1] }), [2])).toThrow(BranchAccessDeniedError)
    })

    it('blocks a manager from a target with no branch links at all (e.g. the owner account)', () => {
        expect(() => requireAnyBranchAccess(user({ branchIds: [1] }), [])).toThrow(BranchAccessDeniedError)
    })
})

describe('requireTaskInstanceAccess', () => {
    it('lets the owner through regardless of branch or assignee', () => {
        expect(() => requireTaskInstanceAccess(user({ role: OWNER_ROLE, branchIds: [] }), 99, 42)).not.toThrow()
    })

    it('lets a manager through for an instance at their own branch', () => {
        expect(() => requireTaskInstanceAccess(user({ branchIds: [1] }), 1, 42)).not.toThrow()
    })

    it('blocks a manager from an instance at a branch they do not manage', () => {
        expect(() => requireTaskInstanceAccess(user({ branchIds: [1] }), 2, 42)).toThrow(BranchAccessDeniedError)
    })

    it('lets a staff member through when they are the assignee', () => {
        expect(() => requireTaskInstanceAccess(user({ userId: 42, role: 'staff', branchIds: [] }), 1, 42)).not.toThrow()
    })

    it('blocks a staff member who is not the assignee', () => {
        expect(() => requireTaskInstanceAccess(user({ userId: 7, role: 'staff', branchIds: [] }), 1, 42)).toThrow(ForbiddenError)
    })
})
