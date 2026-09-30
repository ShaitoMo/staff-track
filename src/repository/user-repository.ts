import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
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
            return await db.user.create({
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
        return db.user.findMany({
            select: SAFE_USER_SELECT,
        });
    }
    static async getUserById(userId: number): Promise<SafeUser | null> {
        return db.user.findUnique({
            where: { userId },
            select: SAFE_USER_SELECT,
        });
    }
    static async updateUser(userId: number, data: UpdateUserInput): Promise<SafeUser> {
        try {
            return await db.user.update({
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
    /** Login only — the one place the password hash is allowed to leave the database. */
    static async getUserByPhoneForAuth(phone: string): Promise<{
        userId: number
        passwordHash: string
        isActive: boolean
        roleName: string
        branchIds: number[]
    } | null> {
        const user = await db.user.findUnique({
            where: { phone },
            select: {
                userId: true,
                passwordHash: true,
                isActive: true,
                role: { select: { name: true } },
                branchLinks: { select: { branchId: true } },
            },
        })

        if (!user) {
            return null
        }

        return {
            userId: user.userId,
            passwordHash: user.passwordHash,
            isActive: user.isActive,
            roleName: user.role.name,
            branchIds: user.branchLinks.map((link) => link.branchId),
        }
    }

    /** Refresh only — separate from getUserByPhoneForAuth so a token refresh never touches the password hash. */
    static async getAuthContext(userId: number): Promise<{
        isActive: boolean
        roleName: string
        branchIds: number[]
    } | null> {
        const user = await db.user.findUnique({
            where: { userId },
            select: {
                isActive: true,
                role: { select: { name: true } },
                branchLinks: { select: { branchId: true } },
            },
        })

        if (!user) {
            return null
        }

        return {
            isActive: user.isActive,
            roleName: user.role.name,
            branchIds: user.branchLinks.map((link) => link.branchId),
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
    static async assertExists(userId: number): Promise<void> {
        const user = await UserRepository.getUserById(userId)

        if (!user) {
            throw new UserNotFoundError()
        }
    }
}
