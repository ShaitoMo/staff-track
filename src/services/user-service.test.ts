import bcrypt from 'bcrypt'

// The repository builds a Prisma adapter at import time.
jest.mock('@/repository/user-repository', () => ({
    UserRepository: { getPasswordHash: jest.fn(), updatePassword: jest.fn() },
}))

import { UserRepository } from '@/repository/user-repository'
import { UserService } from '@/services/user-service'
import { IncorrectPasswordError } from '@/exceptions/incorrect-password-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'

const mockedGetHash = UserRepository.getPasswordHash as jest.Mock
const mockedUpdate = UserRepository.updatePassword as jest.Mock

beforeEach(async () => {
    jest.resetAllMocks()
    mockedGetHash.mockResolvedValue(await bcrypt.hash('old-secret', 4))
})

describe('UserService.changeOwnPassword', () => {
    it('saves a hash of the new password when the current one is right', async () => {
        await UserService.changeOwnPassword(7, 'old-secret', 'new-secret')

        expect(mockedUpdate).toHaveBeenCalledTimes(1)
        const [userId, savedHash] = mockedUpdate.mock.calls[0]
        expect(userId).toBe(7)
        expect(await bcrypt.compare('new-secret', savedHash)).toBe(true)
    })

    it('refuses a wrong current password and saves nothing', async () => {
        await expect(UserService.changeOwnPassword(7, 'guess', 'new-secret')).rejects.toThrow(IncorrectPasswordError)
        expect(mockedUpdate).not.toHaveBeenCalled()
    })

    it('reports a user that no longer exists', async () => {
        mockedGetHash.mockResolvedValue(null)

        await expect(UserService.changeOwnPassword(7, 'old-secret', 'new-secret')).rejects.toThrow(UserNotFoundError)
    })
})
