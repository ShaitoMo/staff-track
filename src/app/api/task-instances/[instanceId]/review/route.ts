import { NextRequest, NextResponse } from 'next/server'
import { TaskInstanceService } from '@/services/task-instance-service'
import { ReviewTaskInstanceSchema } from '@/types/task-instance'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { ForbiddenError } from '@/exceptions/forbidden-error'

/**
 * PATCH /api/task-instances/:instanceId/review
 *
 * Body: { decision: 'verified' | 'rejected', reviewed_by }
 */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/review'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { decision, reviewed_by } = body;

    const validationResult = ReviewTaskInstanceSchema.safeParse({ decision, reviewed_by });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const instance = await TaskInstanceService.reviewInstance({
            instanceId: Number(instanceIdParam),
            decision: validationResult.data.decision,
            reviewedBy: validationResult.data.reviewed_by,
        });

        return NextResponse.json(instance, { status: 200 })
    } catch (error) {
        if (error instanceof TaskInstanceNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof InvalidStatusTransitionError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to review task instance' }, { status: 500 })
    }
}
