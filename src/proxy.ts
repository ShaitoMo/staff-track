import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
    ACCESS_COOKIE_NAME,
    AUTH_HEADER_BRANCH_IDS,
    AUTH_HEADER_ROLE,
    AUTH_HEADER_USER_ID,
    verifyAccessToken,
} from '@/lib/auth'

/**
 * Must stay reachable without a session: you can't log in while already required to be logged in,
 * and logout has to work even with an expired or missing token.
 */
const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'])

/**
 * The one place every /api/* request is authenticated. Runs on the Node.js runtime (Proxy's
 * default since Next 16 — see the version-history note in the framework's own proxy docs), so it
 * can use the same jose-based verification as the rest of the app without any Edge-runtime
 * workaround.
 *
 * On success, the caller's identity is stamped onto trusted request headers for route handlers to
 * read via getCurrentUser. Stripping any client-supplied copies of those headers is unconditional —
 * done before the public-path check, not folded into it — because "this path doesn't require a
 * session" and "this path's headers are trustworthy" are different questions. A public route that
 * later starts reading identity (logout logging who left, say) must see 'nobody', not whatever the
 * client forged, without that route having to remember to sanitize anything itself.
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
