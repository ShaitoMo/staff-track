import { prisma } from '@/lib/db'
import { CreateUserInput, SafeUser } from '@/types/user'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'

export class UserRepository {
    static async createUser(data: CreateUserInput): Promise<SafeUser> {
        try {
            const user = await prisma.user.create({
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
                error instanceof Error &&
                error.message.includes('Unique constraint failed on the fields')
            ) {
                throw new DuplicatePhoneError()
            }
            throw error
        }
    }
    static async getAllUsers(): Promise<SafeUser[]> {
        const users = await prisma.user.findMany();
        return users.map(user => ({
            userId: user.userId,
            name: user.name,
            phone: user.phone,
            roleId: user.roleId,
            isActive: user.isActive,
            createdAt: user.createdAt,
        }));
    }
}
