import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { ReviewTaskInstanceSchema } from '@/types/task-instance'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { logger } from '@/lib/logger'

/** PATCH .../review — body is just { decision }; the reviewer is the session, not a request field. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/review'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { decision } = body;

    const validationResult = ReviewTaskInstanceSchema.safeParse({ decision });

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
            reviewedBy: user.userId,
        });

        return NextResponse.json(instance, { status: 200 })
    } catch (error) {
        if (error instanceof TaskInstanceNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof InvalidStatusTransitionError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        logger.error({ err: error }, 'Failed to review task instance')
        return NextResponse.json({ error: 'Failed to review task instance' }, { status: 500 })
    }
}
