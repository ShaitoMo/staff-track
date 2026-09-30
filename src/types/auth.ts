import { z } from 'zod'

export const LoginSchema = z.object({
    phone: z.string().min(1),
    password: z.string().min(1),
})

export type LoginInput = z.infer<typeof LoginSchema>

/** The refresh token carries identity only — nothing here goes stale. */
export interface RefreshTokenPayload {
    userId: number
}

/** What routes check permissions against — goes stale on a role/branch/active change, bounded by the short TTL. */
export interface AccessTokenPayload {
    userId: number
    role: string
    branchIds: number[]
}
