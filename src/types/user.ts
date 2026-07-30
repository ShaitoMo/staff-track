import { z } from 'zod'

export const UserValidateSchema = z.object({
    name: z.string().min(3).max(50),
    phone: z.string().min(1),
    password: z.string().min(8).max(100),
    roleId: z.number().int().positive(),
})

export type User = z.infer<typeof UserValidateSchema>

export type CreateUserInput = Omit<User, 'password'> & { passwordHash: string }

export type SafeUser = Omit<CreateUserInput, 'passwordHash'> & { userId: number, isActive: boolean, createdAt: Date }
