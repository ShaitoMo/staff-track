import { Role } from "@/types/role";
import { SafeUser } from "@/types/user";

export interface RoleMember {
    userId: number;
    name: string;
    phone: string;
}

export interface RoleWithMembers {
    roleId: number;
    name: string;
    members: RoleMember[];
}

/** Groups the active users under their role; both roles and members come back sorted by name. */
export function buildRoleMembers(roles: Role[], users: SafeUser[]): RoleWithMembers[] {
    const membersByRole = new Map<number, RoleMember[]>();

    for (const user of users) {
        if (!user.isActive) continue;
        const members = membersByRole.get(user.roleId) ?? [];
        members.push({ userId: user.userId, name: user.name, phone: user.phone });
        membersByRole.set(user.roleId, members);
    }

    return [...roles]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((role) => ({
            roleId: role.roleId,
            name: role.name,
            members: (membersByRole.get(role.roleId) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
        }));
}
