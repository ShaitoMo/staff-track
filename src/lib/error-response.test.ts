import { z } from 'zod'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import {
    appErrorResponse,
    errorResponse,
    internalErrorResponse,
    invalidIdResponse,
    invalidJsonResponse,
    unauthenticatedResponse,
    validationErrorResponse,
} from './error-response'

const zodError = z.object({ name: z.string() }).safeParse({}).error!

// every way a route can build an error body (ADR 0002)
const responses = {
    errorResponse: errorResponse(404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found'),
    appErrorResponse: appErrorResponse(new DuplicatePhoneError(), 409),
    validationErrorResponse: validationErrorResponse(zodError, {}),
    invalidJsonResponse: invalidJsonResponse(),
    invalidIdResponse: invalidIdResponse('taskId'),
    unauthenticatedResponse: unauthenticatedResponse(),
    internalErrorResponse: internalErrorResponse('Failed to fetch tasks'),
}

describe('error-response', () => {
    it.each(Object.entries(responses))('%s gives a body with a non-empty error and code', async (_name, res) => {
        const body = await res.json()

        expect(typeof body.error).toBe('string')
        expect(body.error).not.toBe('')
        expect(typeof body.code).toBe('string')
        expect(body.code).not.toBe('')
    })
})
