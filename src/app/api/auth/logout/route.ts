import { NextResponse } from 'next/server'
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth'

/** POST /api/auth/logout — clears both cookies; nothing server-side to revoke since tokens are stateless. */
export async function POST() {
    const res = new NextResponse(null, { status: 204 })
    res.cookies.delete(ACCESS_COOKIE_NAME)
    res.cookies.delete(REFRESH_COOKIE_NAME)
    return res
}
