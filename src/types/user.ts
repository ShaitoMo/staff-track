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

export const USERS_PAGE_DEFAULT_LIMIT = 50
export const USERS_PAGE_MAX_LIMIT = 100

/** `?page=&limit=` on GET /api/users; a limit over the cap is clamped to it, not refused. */
export const UserPageQuerySchema = z.object({
    page: z.coerce.number().int().min(1),
    limit: z.coerce.number().int().min(1).default(USERS_PAGE_DEFAULT_LIMIT)
        .transform((limit) => Math.min(limit, USERS_PAGE_MAX_LIMIT)),
})

export type UserPageQuery = z.infer<typeof UserPageQuerySchema>

export type UserPage = { items: SafeUser[], total: number, page: number, limit: number }

export const UserUpdateSchema = z.object({
    name: z.string().min(3).max(50).optional(),
    phone: z.string().min(1).optional(),
    roleId: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'At least one field must be provided',
    params: { code: 'NO_FIELDS' },
})

export type UpdateUserInput = z.infer<typeof UserUpdateSchema>

/** `currentPassword` is required for Change password (your own) and ignored for Reset password (someone else's). */
export const UpdatePasswordSchema = z.object({
    password: z.string().min(8).max(100),
    currentPassword: z.string().min(1).optional(),
})

export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>
