import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'
import { AccessTokenPayload, RefreshTokenPayload } from '@/types/auth'

export const ACCESS_COOKIE_NAME = 'stafftrack_access'
export const REFRESH_COOKIE_NAME = 'stafftrack_refresh'

const ACCESS_TTL = '15m'
const ACCESS_MAX_AGE_SECONDS = 15 * 60
const REFRESH_TTL = '7d'
const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

function secret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): Uint8Array {
    const value = process.env[name]

    if (!value) {
        throw new Error(`${name} is not set`)
    }

    return new TextEncoder().encode(value)
}

/** Short-lived, carries role/branchIds — kept separate from the refresh token so a role or branch change is stale for at most ACCESS_TTL. */
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(ACCESS_TTL)
        .sign(secret('JWT_ACCESS_SECRET'))
}

/** Long-lived, identity only — its own secret so a leaked access token can't be replayed as this. */
export async function signRefreshToken(userId: number): Promise<string> {
    return new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(REFRESH_TTL)
        .sign(secret('JWT_REFRESH_SECRET'))
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret('JWT_ACCESS_SECRET'))

        if (
            typeof payload.userId !== 'number' ||
            typeof payload.role !== 'string' ||
            !Array.isArray(payload.branchIds) ||
            !payload.branchIds.every((id): id is number => typeof id === 'number')
        ) {
            return null
        }

        return { userId: payload.userId, role: payload.role, branchIds: payload.branchIds }
    } catch {
        return null
    }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret('JWT_REFRESH_SECRET'))

        if (typeof payload.userId !== 'number') {
            return null
        }

        return { userId: payload.userId }
    } catch {
        return null
    }
}

const baseCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
}

export const accessCookieOptions = { ...baseCookieOptions, maxAge: ACCESS_MAX_AGE_SECONDS }
export const refreshCookieOptions = { ...baseCookieOptions, maxAge: REFRESH_MAX_AGE_SECONDS }

/** Set only by proxy.ts, which strips client-supplied copies first — never trust these otherwise. */
export const AUTH_HEADER_USER_ID = 'x-auth-user-id'
export const AUTH_HEADER_ROLE = 'x-auth-role'
export const AUTH_HEADER_BRANCH_IDS = 'x-auth-branch-ids'

/** Reads identity off headers proxy.ts already verified — no repeat JWT check, no DB hit. */
export function getCurrentUser(req: NextRequest): AccessTokenPayload | null {
    const userId = req.headers.get(AUTH_HEADER_USER_ID)
    const role = req.headers.get(AUTH_HEADER_ROLE)
    const branchIdsRaw = req.headers.get(AUTH_HEADER_BRANCH_IDS)

    if (!userId || !role || !branchIdsRaw) {
        return null
    }

    try {
        const branchIds = JSON.parse(branchIdsRaw)

        if (!Array.isArray(branchIds) || !branchIds.every((id): id is number => typeof id === 'number')) {
            return null
        }

        return { userId: Number(userId), role, branchIds }
    } catch {
        return null
    }
}
