import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { CreateUserInput, SafeUser, UpdateUserInput } from '@/types/user'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { InvalidRoleError } from '@/exceptions/invalid-role-error'

const SAFE_USER_SELECT = {
    userId: true,
    name: true,
    phone: true,
    roleId: true,
    isActive: true,
    createdAt: true,
} satisfies Prisma.UserSelect

export class UserRepository {
    static async createUser(data: CreateUserInput): Promise<SafeUser> {
        try {
            return await prisma.user.create({
                data: {
                    name: data.name,
                    phone: data.phone,
                    passwordHash: data.passwordHash,
                    roleId: data.roleId,
                },
                select: SAFE_USER_SELECT,
            })
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new DuplicatePhoneError()
            }
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2003'
            ) {
                throw new InvalidRoleError()
            }
            throw error
        }
    }
    static async getAllUsers(): Promise<SafeUser[]> {
        return prisma.user.findMany({
            select: SAFE_USER_SELECT,
        });
    }
    static async getUserById(userId: number): Promise<SafeUser | null> {
        return prisma.user.findUnique({
            where: { userId },
            select: SAFE_USER_SELECT,
        });
    }
    static async updateUser(userId: number, data: UpdateUserInput): Promise<SafeUser> {
        try {
            return await prisma.user.update({
                where: { userId },
                data: {
                    name: data.name,
                    phone: data.phone,
                    roleId: data.roleId,
                    isActive: data.isActive,
                },
                select: SAFE_USER_SELECT,
            })
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new DuplicatePhoneError()
            }
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new UserNotFoundError()
            }
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2003'
            ) {
                throw new InvalidRoleError()
            }
            throw error
        }
    }
    static async updatePassword(userId: number, passwordHash: string): Promise<void> {
        try {
            await prisma.user.update({
                where: { userId },
                data: { passwordHash },
            })
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new UserNotFoundError()
            }
            throw error
        }
    }
}
