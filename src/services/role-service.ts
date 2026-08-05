import { RolesRepository } from '@/repository/role-repository'
import { Role, CreateRoleInput } from '@/types/role'

export class RoleService {
    static async getAllRoles(): Promise<Role[]> {
        return RolesRepository.getAllRoles()
    }

    static async createRole(data: CreateRoleInput): Promise<Role> {
        return RolesRepository.createRole(data)
    }
    static async getRoleById(roleId: number): Promise<Role | null> {
        return RolesRepository.getRoleById(roleId)
    }
    static async updateRole(roleId: number, data: CreateRoleInput): Promise<Role> {
        return RolesRepository.updateRole(roleId, data)
    }
}
