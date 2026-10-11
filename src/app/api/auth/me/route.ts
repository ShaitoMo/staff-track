import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated } from '@/lib/route-utils'

/** GET /api/auth/me — the caller's identity/permissions; the null check below is defensive, proxy.ts already gates this route. */
export async function GET(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    return NextResponse.json(user, { status: 200 })
}
