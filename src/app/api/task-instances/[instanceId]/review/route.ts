import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { ReviewTaskInstanceSchema } from '@/types/task-instance'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

/** PATCH .../review — body is just { decision }; the reviewer is the session, not a request field. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/review'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return invalidIdResponse('instanceId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return invalidJsonResponse()
    }

    const { decision } = body;

    const validationResult = ReviewTaskInstanceSchema.safeParse({ decision });

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error)
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
            return appErrorResponse(error, 404)
        }
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof InvalidStatusTransitionError) {
            return appErrorResponse(error, 409)
        }
        logger.error({ err: error }, 'Failed to review task instance')
        return internalErrorResponse('Failed to review task instance')
    }
}
