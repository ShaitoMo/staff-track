import { buildRoleMembers } from '@/lib/role-members';
import { SafeUser } from '@/types/user';

function user(userId: number, name: string, roleId: number, isActive = true): SafeUser {
    return { userId, name, phone: `0${userId}`, roleId, isActive, createdAt: new Date('2026-01-01') };
}

const roles = [
    { roleId: 2, name: 'Staff' },
    { roleId: 1, name: 'Cashier' },
];

describe('buildRoleMembers', () => {
    it('sorts roles by name and members by name', () => {
        const result = buildRoleMembers(roles, [user(1, 'Zed', 1), user(2, 'Amal', 1), user(3, 'Noor', 2)]);

        expect(result.map((role) => role.name)).toEqual(['Cashier', 'Staff']);
        expect(result[0].members.map((member) => member.name)).toEqual(['Amal', 'Zed']);
    });

    it('leaves out inactive users', () => {
        const result = buildRoleMembers(roles, [user(1, 'Amal', 1, false), user(2, 'Noor', 1)]);

        expect(result[0].members.map((member) => member.name)).toEqual(['Noor']);
    });

    it('keeps a role with nobody in it, with an empty member list', () => {
        const result = buildRoleMembers(roles, [user(1, 'Amal', 1)]);

        expect(result.find((role) => role.roleId === 2)?.members).toEqual([]);
    });

    it('ignores a user whose role is not in the list', () => {
        const result = buildRoleMembers(roles, [user(1, 'Amal', 99)]);

        expect(result.flatMap((role) => role.members)).toEqual([]);
    });
});
