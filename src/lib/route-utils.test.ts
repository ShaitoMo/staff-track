import { NextRequest, NextResponse } from 'next/server'
import { AccessTokenPayload } from '@/types/auth'

// src/lib/auth.ts pulls in `jose`, an ESM-only package this CommonJS test run can't require;
// stubbing it out keeps this file testing route-utils' own logic, not auth.ts internals.
jest.mock('@/lib/auth', () => ({
    getCurrentUser: jest.fn(),
}))

import { getCurrentUser } from '@/lib/auth'
import { forbiddenResponse, requireAuthenticated } from '@/lib/route-utils'
import { ForbiddenError } from '@/exceptions/forbidden-error'

const mockedGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>

function fakeRequest(): NextRequest {
    return {} as unknown as NextRequest
}

describe('requireAuthenticated', () => {
    it('returns a 401 for a logged-out request the proxy could not identify', async () => {
        mockedGetCurrentUser.mockReturnValue(null)

        const result = requireAuthenticated(fakeRequest())

        expect(result).toBeInstanceOf(NextResponse)
        expect((result as NextResponse).status).toBe(401)
        expect(await (result as NextResponse).json()).toEqual({ error: 'Not authenticated' })
    })

    it('returns the decoded identity once proxy.ts has stamped the auth headers', () => {
        const identity: AccessTokenPayload = { userId: 7, role: 'manager', branchIds: [1, 2] }
        mockedGetCurrentUser.mockReturnValue(identity)

        expect(requireAuthenticated(fakeRequest())).toEqual(identity)
    })
})

describe('forbiddenResponse', () => {
    it('maps a ForbiddenError to a 403 carrying its message', async () => {
        const result = forbiddenResponse(new ForbiddenError('You do not have access to this branch'))

        expect(result?.status).toBe(403)
        expect(await result?.json()).toEqual({ error: 'You do not have access to this branch' })
    })

    it('returns null for any other error, leaving it to the route to handle', () => {
        expect(forbiddenResponse(new Error('boom'))).toBeNull()
    })
})
