import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { CreateUserInput, SafeUser, UpdateUserInput } from '@/types/user'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { InvalidRoleError } from '@/exceptions/invalid-role-error'

export class UserRepository {
    static async createUser(data: CreateUserInput): Promise<SafeUser> {
        try {
            const user = await db.user.create({
                data: {
                    name: data.name,
                    phone: data.phone,
                    passwordHash: data.passwordHash,
                    roleId: data.roleId,
                },
            })

            return {
                userId: user.userId,
                name: user.name,
                phone: user.phone,
                roleId: user.roleId,
                isActive: user.isActive,
                createdAt: user.createdAt,
            }
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
        const users = await db.user.findMany();
        return users.map(user => ({
            userId: user.userId,
            name: user.name,
            phone: user.phone,
            roleId: user.roleId,
            isActive: user.isActive,
            createdAt: user.createdAt,
        }));
    }
    static async getUserById(userId: number): Promise<SafeUser | null> {
        const user = await db.user.findUnique({
            where: { userId },
        });

        if (!user) {
            return null;
        }

        return {
            userId: user.userId,
            name: user.name,
            phone: user.phone,
            roleId: user.roleId,
            isActive: user.isActive,
            createdAt: user.createdAt,
        };
    }
    static async updateUser(userId: number, data: UpdateUserInput): Promise<SafeUser> {
        try {
            const user = await db.user.update({
                where: { userId },
                data: {
                    name: data.name,
                    phone: data.phone,
                    roleId: data.roleId,
                    isActive: data.isActive,
                },
            })

            return {
                userId: user.userId,
                name: user.name,
                phone: user.phone,
                roleId: user.roleId,
                isActive: user.isActive,
                createdAt: user.createdAt,
            }
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
            await db.user.update({
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
