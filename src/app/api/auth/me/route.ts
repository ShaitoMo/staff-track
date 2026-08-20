import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/auth/me — the identity/permissions any route guard would read. Reachable only because
 * src/proxy.ts already authenticated the request; the check below is defensive, matching how
 * every other route in this codebase validates its inputs rather than assuming.
 */
export async function GET(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json(user, { status: 200 })
}
