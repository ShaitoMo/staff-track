import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { Role, CreateRoleInput } from '@/types/role'
import { DuplicateRoleNameError } from '@/exceptions/duplicate-role-name-error'
export class RolesRepository {
    static async getAllRoles(): Promise<Role []> {
        const roles = await prisma.role.findMany({
            select: {
                roleId: true,
                name: true,
            },
        })
        return roles
    }
    static async createRole(role: CreateRoleInput): Promise<Role> {
        try {
            const newRole = await prisma.role.create({
                data: {
                    name: role.name,
                },
            })
            return newRole
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new DuplicateRoleNameError()
            }
            throw error
        }
    }
}