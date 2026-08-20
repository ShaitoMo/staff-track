import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/** GET /api/auth/me — the caller's identity/permissions; the null check below is defensive, proxy.ts already gates this route. */
export async function GET(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json(user, { status: 200 })
}
