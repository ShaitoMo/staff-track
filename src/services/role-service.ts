import { RolesRepository } from '@/repository/role-repository'
import { Role, CreateRoleInput } from '@/types/role'

export class RoleService {
    static async getAllRoles(): Promise<Role[]> {
        return RolesRepository.getAllRoles()
    }

    static async createRole(data: CreateRoleInput): Promise<Role> {
        return RolesRepository.createRole(data)
    }
}
