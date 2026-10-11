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

// the role-holder rule re-reads the caller; the real service would reach for Prisma
jest.mock('@/services/user-service', () => ({ UserService: { getUserById: jest.fn() } }))

import { UserService } from '@/services/user-service'

const mockedGetUserById = UserService.getUserById as jest.Mock

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
    type Subject = Parameters<typeof requireTaskInstanceAccess>[1]

    function instance(overrides: { completedBy?: number | null; assigneeId?: number | null; branchId?: number; roleId?: number | null } = {}): Subject {
        const { completedBy = null, assigneeId = null, branchId = 1, roleId = null } = overrides
        return {
            completed_by: completedBy,
            assignee: assigneeId === null ? null : { user_id: assigneeId },
            task: { branch_id: branchId, assigned_role_id: roleId },
        }
    }

    const staff = (overrides: Partial<AccessTokenPayload> = {}) => user({ userId: 7, role: 'staff', branchIds: [1], ...overrides })

    beforeEach(() => {
        mockedGetUserById.mockReset()
    })

    it('lets the owner through regardless of branch or assignee', async () => {
        await expect(requireTaskInstanceAccess(user({ role: OWNER_ROLE, branchIds: [] }), instance({ branchId: 99, assigneeId: 42 }))).resolves.toBeUndefined()
    })

    it('lets a manager through for an instance at their own branch', async () => {
        await expect(requireTaskInstanceAccess(user({ branchIds: [1] }), instance({ assigneeId: 42 }))).resolves.toBeUndefined()
    })

    it('blocks a manager from an instance at a branch they do not manage', async () => {
        await expect(requireTaskInstanceAccess(user({ branchIds: [1] }), instance({ branchId: 2 }))).rejects.toThrow(BranchAccessDeniedError)
    })

    it('lets a staff member through when they are the named assignee', async () => {
        await expect(requireTaskInstanceAccess(staff({ userId: 42, branchIds: [] }), instance({ assigneeId: 42 }))).resolves.toBeUndefined()
        expect(mockedGetUserById).not.toHaveBeenCalled()
    })

    it('lets a staff member through when they completed it, even on a role task', async () => {
        await expect(requireTaskInstanceAccess(staff(), instance({ completedBy: 7, roleId: 3 }))).resolves.toBeUndefined()
        expect(mockedGetUserById).not.toHaveBeenCalled()
    })

    it("blocks a staff member from someone else's named task", async () => {
        await expect(requireTaskInstanceAccess(staff(), instance({ assigneeId: 42 }))).rejects.toThrow(ForbiddenError)
    })

    it('lets an active holder of the targeted role through at a branch they work at', async () => {
        mockedGetUserById.mockResolvedValue({ userId: 7, roleId: 3, isActive: true })

        await expect(requireTaskInstanceAccess(staff(), instance({ roleId: 3 }))).resolves.toBeUndefined()
    })

    it('blocks a user holding a different role', async () => {
        mockedGetUserById.mockResolvedValue({ userId: 7, roleId: 4, isActive: true })

        await expect(requireTaskInstanceAccess(staff(), instance({ roleId: 3 }))).rejects.toThrow(ForbiddenError)
    })

    it('blocks a deactivated user who holds the role', async () => {
        mockedGetUserById.mockResolvedValue({ userId: 7, roleId: 3, isActive: false })

        await expect(requireTaskInstanceAccess(staff(), instance({ roleId: 3 }))).rejects.toThrow(ForbiddenError)
    })

    it('blocks a role holder at a branch they do not work at, without reading the user', async () => {
        await expect(requireTaskInstanceAccess(staff({ branchIds: [2] }), instance({ roleId: 3 }))).rejects.toThrow(ForbiddenError)
        expect(mockedGetUserById).not.toHaveBeenCalled()
    })
})
