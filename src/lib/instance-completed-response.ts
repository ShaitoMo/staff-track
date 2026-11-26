import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/error-response'
import type { CompletedInstanceState, TaskInstanceDetailView } from '@/types/task-instance'

/**
 * The 409 for completing an instance that is no longer pending: it carries the instance's current
 * state, which the route loads itself, so the row can update in place. Without an instance (the
 * reload failed) it is the same 409 with no state.
 */
export function instanceAlreadyCompletedResponse(instance: TaskInstanceDetailView | null): NextResponse {
    const current: CompletedInstanceState | undefined = instance
        ? {
            status: instance.status,
            completed_by_name: instance.completed_by_name,
            completed_at: instance.completed_at?.toISOString() ?? null,
        }
        : undefined

    return errorResponse(409, 'INSTANCE_ALREADY_COMPLETED', 'This task instance has already been completed', { current })
}
