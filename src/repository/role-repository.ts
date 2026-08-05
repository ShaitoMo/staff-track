import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { Role, CreateRoleInput } from '@/types/role'
import { DuplicateRoleNameError } from '@/exceptions/duplicate-role-name-error'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'
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
    static async getRoleById(roleId: number): Promise<Role | null> {
        const role = await prisma.role.findUnique({
            where: {   
                roleId: roleId,
            },
            select: {
                roleId: true,
                name: true,
            },
        })
        return role
    }
    static async updateRole(roleId: number, data: CreateRoleInput): Promise<Role> {
        try {
            const role = await prisma.role.update({
                where: {
                    roleId: roleId,
                },
                data: {
                    name: data.name,
                },
                select: {
                    roleId: true,
                    name: true,
                },
            })
            return role
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new DuplicateRoleNameError()
            }
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new RoleNotFoundError()
            }
            throw error
        }
    }
}