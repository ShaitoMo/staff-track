import bcrypt from 'bcrypt'
import { UserRepository } from '@/repository/user-repository'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth'
import { LoginInput } from '@/types/auth'
import { InvalidCredentialsError } from '@/exceptions/invalid-credentials-error'
import { InvalidRefreshTokenError } from '@/exceptions/invalid-refresh-token-error'

/**
 * A password change signs out every other session (ADR 0001). `iat` is whole seconds, so a token
 * minted in the same second as the change counts as after it: the device that changed it keeps its new cookies.
 */
function issuedBeforePasswordChange(issuedAtSeconds: number, passwordChangedAt: Date | null): boolean {
    return passwordChangedAt !== null && issuedAtSeconds < Math.floor(passwordChangedAt.getTime() / 1000)
}

export class AuthService {
    /** Wrong phone, wrong password, and deactivated all return the same error — no account enumeration. */
    static async login(data: LoginInput): Promise<{ accessToken: string; refreshToken: string; userId: number }> {
        const user = await UserRepository.getUserByPhoneForAuth(data.phone)

        if (!user || !user.isActive) {
            throw new InvalidCredentialsError()
        }

        const passwordMatches = await bcrypt.compare(data.password, user.passwordHash)

        if (!passwordMatches) {
            throw new InvalidCredentialsError()
        }

        const [accessToken, refreshToken] = await Promise.all([
            signAccessToken({ userId: user.userId, role: user.roleName, branchIds: user.branchIds }),
            signRefreshToken(user.userId),
        ])

        return { accessToken, refreshToken, userId: user.userId }
    }

    /** Fresh tokens for a User already proven to be themselves, e.g. right after Change password signed out every other session. */
    static async startSession(userId: number): Promise<{ accessToken: string; refreshToken: string }> {
        const context = await UserRepository.getAuthContext(userId)

        if (!context || !context.isActive) {
            throw new InvalidRefreshTokenError()
        }

        const [accessToken, refreshToken] = await Promise.all([
            signAccessToken({ userId, role: context.roleName, branchIds: context.branchIds }),
            signRefreshToken(userId),
        ])

        return { accessToken, refreshToken }
    }

    /** Mints a new access token from the refresh token's identity plus the user's *current* role/branch/active state. */
    static async refresh(rawRefreshToken: string): Promise<string> {
        const refreshPayload = await verifyRefreshToken(rawRefreshToken)

        if (!refreshPayload) {
            throw new InvalidRefreshTokenError()
        }

        const context = await UserRepository.getAuthContext(refreshPayload.userId)

        if (!context || !context.isActive || issuedBeforePasswordChange(refreshPayload.issuedAt, context.passwordChangedAt)) {
            throw new InvalidRefreshTokenError()
        }

        return signAccessToken({
            userId: refreshPayload.userId,
            role: context.roleName,
            branchIds: context.branchIds,
        })
    }
}
