import bcrypt from 'bcrypt'
import { UserRepository } from '@/repository/user-repository'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth'
import { LoginInput } from '@/types/auth'
import { InvalidCredentialsError } from '@/exceptions/invalid-credentials-error'
import { InvalidRefreshTokenError } from '@/exceptions/invalid-refresh-token-error'

export class AuthService {
    /**
     * A wrong phone, a wrong password, and a deactivated account all return the same error —
     * telling them apart would let a caller enumerate which phone numbers have accounts, or which
     * accounts are currently disabled.
     */
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

    /**
     * Mints a new access token from the refresh token's identity plus the user's *current*
     * role/branch/active state — this is what keeps a role change or deactivation from waiting out
     * the old access token's TTL.
     */
    static async refresh(rawRefreshToken: string): Promise<string> {
        const refreshPayload = await verifyRefreshToken(rawRefreshToken)

        if (!refreshPayload) {
            throw new InvalidRefreshTokenError()
        }

        const context = await UserRepository.getAuthContext(refreshPayload.userId)

        if (!context || !context.isActive) {
            throw new InvalidRefreshTokenError()
        }

        return signAccessToken({
            userId: refreshPayload.userId,
            role: context.roleName,
            branchIds: context.branchIds,
        })
    }
}
