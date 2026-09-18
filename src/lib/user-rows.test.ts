import { buildUserRows } from '@/lib/user-rows';
import { Branch } from '@/types/branch';
import { Role } from '@/types/role';
import { SafeUser } from '@/types/user';

const roles: Role[] = [
    { roleId: 1, name: 'owner' },
    { roleId: 2, name: 'manager' },
    { roleId: 3, name: 'cashier' },
];

const branches: Branch[] = [
    { branchId: 10, name: 'Main Branch' },
    { branchId: 20, name: 'Downtown Branch' },
];

function user(overrides: Partial<SafeUser> & Pick<SafeUser, 'userId' | 'name' | 'roleId'>): SafeUser {
    return {
        phone: '555-0000',
        isActive: true,
        createdAt: new Date('2026-01-01'),
        ...overrides,
    };
}

describe('buildUserRows', () => {
    it('resolves the role name from roleId', () => {
        const [row] = buildUserRows(
            [user({ userId: 1, name: 'Alice', roleId: 2 })],
            roles,
            branches,
            [],
        );

        expect(row.roleName).toBe('manager');
    });

    it('falls back to a placeholder when the roleId has no matching role', () => {
        const [row] = buildUserRows(
            [user({ userId: 1, name: 'Alice', roleId: 999 })],
            roles,
            branches,
            [],
        );

        expect(row.roleName).toBe('Unknown role');
    });

    it('resolves branch chips from userBranches, including multiple branches', () => {
        const [row] = buildUserRows(
            [user({ userId: 1, name: 'Alice', roleId: 2 })],
            roles,
            branches,
            [
                { userId: 1, branchId: 10 },
                { userId: 1, branchId: 20 },
            ],
        );

        expect(row.branchChips).toEqual(['Main Branch', 'Downtown Branch']);
    });

    it('only includes branch links belonging to that user', () => {
        const [row] = buildUserRows(
            [user({ userId: 1, name: 'Alice', roleId: 2 })],
            roles,
            branches,
            [
                { userId: 1, branchId: 10 },
                { userId: 2, branchId: 20 },
            ],
        );

        expect(row.branchChips).toEqual(['Main Branch']);
    });

    it('shows "All branches" for an owner with no branch links', () => {
        const [row] = buildUserRows(
            [user({ userId: 1, name: 'Olivia Owner', roleId: 1 })],
            roles,
            branches,
            [],
        );

        expect(row.branchChips).toEqual(['All branches']);
    });

    it('shows "Unassigned" for a non-owner with no branch links', () => {
        const [row] = buildUserRows(
            [user({ userId: 1, name: 'New Cashier', roleId: 3 })],
            roles,
            branches,
            [],
        );

        expect(row.branchChips).toEqual(['Unassigned']);
    });

    it('carries isActive through unchanged', () => {
        const [row] = buildUserRows(
            [user({ userId: 1, name: 'Alice', roleId: 2, isActive: false })],
            roles,
            branches,
            [],
        );

        expect(row.isActive).toBe(false);
    });

    it('sorts rows alphabetically by name', () => {
        const rows = buildUserRows(
            [
                user({ userId: 1, name: 'Zoe', roleId: 3 }),
                user({ userId: 2, name: 'Alice', roleId: 2 }),
                user({ userId: 3, name: 'Mike', roleId: 3 }),
            ],
            roles,
            branches,
            [],
        );

        expect(rows.map((row) => row.name)).toEqual(['Alice', 'Mike', 'Zoe']);
    });
});
