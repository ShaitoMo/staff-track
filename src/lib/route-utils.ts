import { NextRequest, NextResponse } from 'next/server'
import { ZodType } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { AccessTokenPayload } from '@/types/auth'
import { AppError } from '@/exceptions/app-error'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import {
    appErrorResponse,
    internalErrorResponse,
    invalidJsonResponse,
    unauthenticatedResponse,
    validationErrorResponse,
} from '@/lib/error-response'

export function parseNumericId(value: string): number | null {
    if (!/^\d+$/.test(value)) {
        return null
    }
    return Number(value)
}

export type ParsedBody<T> = { data: T; error?: undefined } | { data?: undefined; error: NextResponse }

export async function parseJsonBody<T>(req: NextRequest, schema: ZodType<T>): Promise<ParsedBody<T>> {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return { error: invalidJsonResponse() }
    }

    const result = schema.safeParse(body)

    if (!result.success) {
        return { error: validationErrorResponse(result.error, body) }
    }

    return { data: result.data }
}

/**
 * Runs a GET handler's read, mapping one specific not-found error to a 404 (with its own code)
 * and everything else to a 500 with `failureMessage` — the shape every simple GET-by-id route in
 * this codebase already repeats by hand.
 */
export async function getOrNotFound<T>(
    handler: () => Promise<T>,
    NotFoundErrorClass: new () => AppError,
    failureMessage: string,
): Promise<NextResponse> {
    try {
        const data = await handler()
        return NextResponse.json(data, { status: 200 })
    } catch (error) {
        if (error instanceof NotFoundErrorClass) {
            return appErrorResponse(error, 404)
        }
        console.error(error)
        return internalErrorResponse(failureMessage)
    }
}

/**
 * The session check every protected route repeats: read the identity proxy.ts already verified,
 * or hand back the 401 to return as-is. `instanceof NextResponse` is what narrows the union back
 * to a user at the call site.
 */
export function requireAuthenticated(req: NextRequest): AccessTokenPayload | NextResponse {
    const user = getCurrentUser(req)
    return user ?? unauthenticatedResponse()
}

/**
 * Maps a caught `ForbiddenError` (from requireRole/requireBranchAccess/requireSelfOrRole) to its
 * 403, or returns null for anything else so the route's own catch can keep checking.
 */
export function forbiddenResponse(error: unknown): NextResponse | null {
    return error instanceof ForbiddenError ? appErrorResponse(error, 403) : null
}
