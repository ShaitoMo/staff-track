import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
    ACCESS_COOKIE_NAME,
    AUTH_HEADER_BRANCH_IDS,
    AUTH_HEADER_ROLE,
    AUTH_HEADER_USER_ID,
    verifyAccessToken,
} from '@/lib/auth'

/** Reachable without a session — login/refresh can't require what they grant, and logout must survive an expired token. */
const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'])

/**
 * Authenticates every /api/* request once, on the Node.js runtime Proxy defaults to since Next 16.
 * Header stripping runs before the public-path check, not inside it, so a public route that later
 * reads identity sees 'nobody' rather than forged headers, with no sanitizing of its own required.
 */
export async function proxy(request: NextRequest) {
    const headers = new Headers(request.headers)
    headers.delete(AUTH_HEADER_USER_ID)
    headers.delete(AUTH_HEADER_ROLE)
    headers.delete(AUTH_HEADER_BRANCH_IDS)

    if (PUBLIC_PATHS.has(request.nextUrl.pathname)) {
        return NextResponse.next({ request: { headers } })
    }

    const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value
    const user = token ? await verifyAccessToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    headers.set(AUTH_HEADER_USER_ID, String(user.userId))
    headers.set(AUTH_HEADER_ROLE, user.role)
    headers.set(AUTH_HEADER_BRANCH_IDS, JSON.stringify(user.branchIds))

    return NextResponse.next({ request: { headers } })
}

export const config = {
    matcher: ['/api/:path*'],
}
