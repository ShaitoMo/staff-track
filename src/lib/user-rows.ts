import { OWNER_ROLE } from '@/lib/rbac';
import { Branch } from '@/types/branch';
import { Role } from '@/types/role';
import { SafeUser } from '@/types/user';
import { UserBranch } from '@/types/user-branch';

export interface UserRow {
    userId: number;
    name: string;
    phone: string;
    roleName: string;
    isActive: boolean;
    branchChips: string[];
}

/**
 * Joins the raw GET /api/users, /api/roles, /api/branches, and /api/user-branches responses
 * into one sortable, chip-ready row per user. Branch filtering happens server-side (branch_id
 * on GET /api/users); this only joins and sorts whatever list it's handed.
 */
export function buildUserRows(
    users: SafeUser[],
    roles: Role[],
    branches: Branch[],
    userBranches: UserBranch[],
): UserRow[] {
    const roleNameById = new Map(roles.map((role) => [role.roleId, role.name]));
    const branchNameById = new Map(branches.map((branch) => [branch.branchId, branch.name]));

    const rows = users.map((user): UserRow => {
        const roleName = roleNameById.get(user.roleId) ?? 'Unknown role';
        const links = userBranches.filter((link) => link.userId === user.userId);
        const branchChips = links.length > 0
            ? links.map((link) => branchNameById.get(link.branchId) ?? 'Unknown branch')
            : [roleName === OWNER_ROLE ? 'All branches' : 'Unassigned'];

        return {
            userId: user.userId,
            name: user.name,
            phone: user.phone,
            roleName,
            isActive: user.isActive,
            branchChips,
        };
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name));
}
