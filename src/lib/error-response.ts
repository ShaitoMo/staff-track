import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'
import type { AppError } from '@/exceptions/app-error'
import type { ErrorBody, FieldError } from '@/types/api-error'

/**
 * Builds every error body /api/* returns (ADR 0002), so the shape lives in one place. `message`
 * is the English fallback; `code` is what the client translates.
 */
export function errorResponse(
    status: number,
    code: string,
    message: string,
    extra: Pick<ErrorBody, 'fields' | 'current'> = {},
): NextResponse {
    const body: ErrorBody = { error: message, code, ...extra }
    return NextResponse.json(body, { status })
}

/** A domain error at the status the route chose for it; one tied to a field also names it in `fields`. */
export function appErrorResponse(error: AppError, status: number, current?: unknown): NextResponse {
    return errorResponse(status, error.code, error.message, {
        ...(error.field ? { fields: [{ path: error.field, code: error.code }] } : {}),
        ...(current === undefined ? {} : { current }),
    })
}

/**
 * A failed schema parse: one field code per issue. `input` is what was parsed, so a missing value
 * reads as REQUIRED rather than a wrong type.
 */
export function validationErrorResponse(error: ZodError, input?: unknown): NextResponse {
    const fields: FieldError[] = error.issues.map(issue => ({
        path: issue.path.join('.'),
        code: fieldCode(issue, input),
    }))
    const message = error.issues
        .map(issue => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
        .join('; ')
    return errorResponse(400, 'VALIDATION_FAILED', message, { fields })
}

export function invalidJsonResponse(): NextResponse {
    return errorResponse(400, 'INVALID_JSON', 'Invalid JSON body')
}

/** A path or query id that isn't a number, e.g. `invalidIdResponse('taskId')`. */
export function invalidIdResponse(name: string): NextResponse {
    return errorResponse(400, 'INVALID_ID', `Invalid ${name}`)
}

export function unauthenticatedResponse(): NextResponse {
    return errorResponse(401, 'UNAUTHENTICATED', 'Not authenticated')
}

/** Every 500; the route logs the cause itself. */
export function internalErrorResponse(message: string): NextResponse {
    return errorResponse(500, 'INTERNAL', message)
}

type Issue = ZodError['issues'][number]

const LENGTH_ORIGINS = new Set(['string', 'array', 'set', 'file'])

/** A custom rule's own `params.code` wins; otherwise the issue kind maps to a small generic set. */
function fieldCode(issue: Issue, input: unknown): string {
    if (issue.code === 'custom' && typeof issue.params?.code === 'string') {
        return issue.params.code
    }

    switch (issue.code) {
        case 'invalid_type':
            return input !== undefined && valueAt(input, issue.path) == null ? 'REQUIRED' : 'INVALID'
        case 'too_small':
            if (!LENGTH_ORIGINS.has(issue.origin)) return 'OUT_OF_RANGE'
            return Number(issue.minimum) <= 1 ? 'REQUIRED' : 'TOO_SHORT'
        case 'too_big':
            return LENGTH_ORIGINS.has(issue.origin) ? 'TOO_LONG' : 'OUT_OF_RANGE'
        case 'invalid_format':
            return 'INVALID_FORMAT'
        default:
            return 'INVALID'
    }
}

function valueAt(input: unknown, path: PropertyKey[]): unknown {
    let value = input
    for (const key of path) {
        if (typeof value !== 'object' || value === null) return undefined
        value = (value as Record<PropertyKey, unknown>)[key]
    }
    return value
}
