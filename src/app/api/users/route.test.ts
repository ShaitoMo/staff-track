import { NextRequest } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// auth.ts pulls in `jose` (ESM-only); the service and logger would reach for Prisma and pino.
jest.mock('@/lib/auth', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
jest.mock('@/services/user-service', () => ({
    UserService: { createUser: jest.fn(), getAllUsers: jest.fn(), getUsersPage: jest.fn() },
}))

import { getCurrentUser } from '@/lib/auth'
import { UserService } from '@/services/user-service'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { GET, POST } from './route'

const mockedGetCurrentUser = getCurrentUser as jest.Mock
const mockedCreateUser = UserService.createUser as jest.Mock
const mockedGetAllUsers = UserService.getAllUsers as jest.Mock
const mockedGetUsersPage = UserService.getUsersPage as jest.Mock

const owner: AccessTokenPayload = { userId: 1, role: 'owner', branchIds: [] }
const manager: AccessTokenPayload = { userId: 2, role: 'manager', branchIds: [4, 7] }

const layla = { userId: 5, name: 'Layla', phone: '0790000000', roleId: 3, isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }

function post(body: unknown) {
    const req = new NextRequest('http://localhost/api/users', { method: 'POST', body: JSON.stringify(body) })
    return POST(req)
}

function get(query = '') {
    return GET(new NextRequest(`http://localhost/api/users${query}`))
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

describe('GET /api/users', () => {
    it('answers ?page with one page of users and the total', async () => {
        mockedGetUsersPage.mockResolvedValue({ items: [layla], total: 51 })

        const res = await get('?page=2')

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ items: [layla], total: 51, page: 2, limit: 50 })
        expect(mockedGetUsersPage).toHaveBeenCalledWith(undefined, 2, 50)
    })

    it('answers without ?page with the full array, as the User pickers expect', async () => {
        mockedGetAllUsers.mockResolvedValue([layla])

        const res = await get('?branch_id=4')

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([layla])
        expect(mockedGetUsersPage).not.toHaveBeenCalled()
    })

    it("counts a manager's total over their own branches only", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetUsersPage.mockResolvedValue({ items: [layla], total: 3 })

        const res = await get('?page=1')

        expect(await res.json()).toEqual({ items: [layla], total: 3, page: 1, limit: 50 })
        expect(mockedGetUsersPage).toHaveBeenCalledWith([4, 7], 1, 50)
    })

    it("narrows a manager's page and total to the branch_id they asked for", async () => {
        mockedGetCurrentUser.mockReturnValue(manager)
        mockedGetUsersPage.mockResolvedValue({ items: [], total: 0 })

        await get('?page=1&branch_id=7')

        expect(mockedGetUsersPage).toHaveBeenCalledWith([7], 1, 50)
    })

    it('caps limit at 100', async () => {
        mockedGetUsersPage.mockResolvedValue({ items: [], total: 0 })

        const res = await get('?page=1&limit=500')

        expect((await res.json()).limit).toBe(100)
        expect(mockedGetUsersPage).toHaveBeenCalledWith(undefined, 1, 100)
    })

    it('refuses a page that is not a positive whole number with 400', async () => {
        const res = await get('?page=0')

        expect(res.status).toBe(400)
        expect(mockedGetUsersPage).not.toHaveBeenCalled()
    })
})
