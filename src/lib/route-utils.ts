import { NextRequest, NextResponse } from 'next/server'
import { ZodError, ZodType } from 'zod'

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

function formatZodError(error: ZodError): string {
    return error.issues
        .map(issue => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
        .join('; ')
}

export type ParsedBody<T> = { data: T; error?: undefined } | { data?: undefined; error: NextResponse }

export async function parseJsonBody<T>(req: NextRequest, schema: ZodType<T>): Promise<ParsedBody<T>> {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return { error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
    }

    const result = schema.safeParse(body)

    if (!result.success) {
        return { error: NextResponse.json({ error: formatZodError(result.error) }, { status: 400 }) }
    }

    return { data: result.data }
}

/**
 * Runs a GET handler's read, mapping one specific not-found error to a 404 (with its own message)
 * and everything else to a 500 with `failureMessage` — the shape every simple GET-by-id route in
 * this codebase already repeats by hand.
 */
export async function getOrNotFound<T>(
    handler: () => Promise<T>,
    NotFoundErrorClass: new () => Error,
    failureMessage: string,
): Promise<NextResponse> {
    try {
        const data = await handler()
        return NextResponse.json(data, { status: 200 })
    } catch (error) {
        if (error instanceof NotFoundErrorClass) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error)
        return NextResponse.json({ error: failureMessage }, { status: 500 })
    }
}
