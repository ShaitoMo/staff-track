import { RoleRepository } from '@/repository/role-repository'
import { Role, CreateRoleInput } from '@/types/role'

export class RoleService {
    static async getAllRoles(): Promise<Role[]> {
        return RoleRepository.getAllRoles()
    }

    static async createRole(data: CreateRoleInput): Promise<Role> {
        return RoleRepository.createRole(data)
    }
    static async getRoleById(roleId: number): Promise<Role | null> {
        return RoleRepository.getRoleById(roleId)
    }
    static async updateRole(roleId: number, data: CreateRoleInput): Promise<Role> {
        return RoleRepository.updateRole(roleId, data)
    }
}
