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

/**
 * The access token carries what routes actually check permissions against. It goes stale the
 * moment a role, branch link, or active flag changes underneath it — bounded by the access
 * token's short TTL and cleared by the next refresh, not by re-querying on every request.
 */
export interface AccessTokenPayload {
    userId: number
    role: string
    branchIds: number[]
}
