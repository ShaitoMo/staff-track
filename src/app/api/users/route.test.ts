import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/user-service', () => ({ UserService: { createUser: jest.fn() } }))

import { getCurrentUser } from '@/lib/auth'
import { UserService } from '@/services/user-service'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { POST } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedCreateUser = UserService.createUser as jest.Mock

const owner: AccessTokenPayload = { userId: 1, role: 'owner', branchIds: [] }

function post(body: unknown) {
    const req = new NextRequest('http://localhost/api/users', { method: 'POST', body: JSON.stringify(body) })
    return POST(req)
}

beforeEach(() => {
    jest.resetAllMocks()
    mockedGetCurrentUser.mockReturnValue(owner)
})

describe('POST /api/users', () => {
    it('answers a taken phone with 409 DUPLICATE_PHONE, placed on the phone field', async () => {
        mockedCreateUser.mockRejectedValue(new DuplicatePhoneError())

        const res = await post({ name: 'Layla', phone: '0790000000', password: 'secret-pass', roleId: 3 })

        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({
            error: 'User with this phone number already exists',
            code: 'DUPLICATE_PHONE',
            fields: [{ path: 'phone', code: 'DUPLICATE_PHONE' }],
        })
    })
})
