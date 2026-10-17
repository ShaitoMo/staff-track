import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { InvalidPhotoError } from '@/lib/storage'
import { CompleteTaskInstanceSchema } from '@/types/task-instance'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { InactiveTaskError } from '@/exceptions/inactive-task-error'
import { logger } from '@/lib/logger'

/**
 * PATCH .../complete — body is { photo_key } for a photo already uploaded via POST .../photo-upload;
 * completer and completed_at both come from the session/server clock, not the body.
 */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/complete'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    const instanceId = parseNumericId(instanceIdParam);

    if (instanceId === null) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const { data, error: bodyError } = await parseJsonBody(req, CompleteTaskInstanceSchema);

    if (bodyError) {
        return bodyError;
    }

    try {
        const instance = await TaskInstanceService.completeInstance({
            instanceId,
            completedBy: user.userId,
            photoKey: data.photo_key,
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
        if (error instanceof InvalidStatusTransitionError || error instanceof InactiveTaskError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (error instanceof InvalidPhotoError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to complete task instance')
        return NextResponse.json({ error: 'Failed to complete task instance' }, { status: 500 })
    }
}
