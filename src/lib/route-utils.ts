import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export function parseNumericId(value: string): number | null {
    if (!/^\d+$/.test(value)) {
        return null
    }
    return Number(value)
}

export function zodErrorResponse(error: ZodError) {
    const errors = error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
    }))
    return NextResponse.json({ error: errors }, { status: 400 })
}
