// auth.ts pulls in `jose` (ESM-only); the repository would reach for Prisma.
jest.mock('@/lib/auth', () => ({
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
}))
jest.mock('@/repository/user-repository', () => ({
    UserRepository: { getAuthContext: jest.fn() },
}))

import { signAccessToken, verifyRefreshToken } from '@/lib/auth'
import { UserRepository } from '@/repository/user-repository'
import { AuthService } from '@/services/auth-service'
import { InvalidRefreshTokenError } from '@/exceptions/invalid-refresh-token-error'

const mockedVerify = verifyRefreshToken as jest.Mock
const mockedContext = UserRepository.getAuthContext as jest.Mock
const mockedSignAccess = signAccessToken as jest.Mock

/** 2026-11-22T10:00:00Z, in JWT seconds. */
const CHANGED_AT_SECONDS = Date.UTC(2026, 10, 22, 10, 0, 0) / 1000

const context = (passwordChangedAt: Date | null) => ({
    isActive: true,
    roleName: 'cashier',
    branchIds: [1],
    passwordChangedAt,
})

beforeEach(() => {
    jest.resetAllMocks()
    mockedSignAccess.mockResolvedValue('new-access')
})

describe('AuthService.refresh', () => {
    it('refuses a refresh token issued before the last password change', async () => {
        mockedVerify.mockResolvedValue({ userId: 7, issuedAt: CHANGED_AT_SECONDS - 1 })
        mockedContext.mockResolvedValue(context(new Date(CHANGED_AT_SECONDS * 1000)))

        await expect(AuthService.refresh('old')).rejects.toThrow(InvalidRefreshTokenError)
        expect(mockedSignAccess).not.toHaveBeenCalled()
    })

    it('accepts a refresh token issued in the same second as the change, so the changing device stays signed in', async () => {
        mockedVerify.mockResolvedValue({ userId: 7, issuedAt: CHANGED_AT_SECONDS })
        mockedContext.mockResolvedValue(context(new Date(CHANGED_AT_SECONDS * 1000 + 400)))

        await expect(AuthService.refresh('fresh')).resolves.toBe('new-access')
    })

    it('accepts any refresh token for a user who never changed their password', async () => {
        mockedVerify.mockResolvedValue({ userId: 7, issuedAt: CHANGED_AT_SECONDS - 86400 })
        mockedContext.mockResolvedValue(context(null))

        await expect(AuthService.refresh('any')).resolves.toBe('new-access')
    })
})
