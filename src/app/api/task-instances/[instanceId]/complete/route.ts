import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { InvalidPhotoError } from '@/lib/storage'
import { CompleteTaskInstanceSchema } from '@/types/task-instance'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { InactiveTaskError } from '@/exceptions/inactive-task-error'
import { logger } from '@/lib/logger'
import { instanceAlreadyCompletedResponse } from '@/lib/instance-completed-response'
import { appErrorResponse, internalErrorResponse, invalidIdResponse } from '@/lib/error-response'

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
        return invalidIdResponse('instanceId');
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
            return appErrorResponse(error, 404)
        }
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        // the only transition these routes attempt is to completed, so this means a teammate got there first;
        // the completion checks have already passed, so the caller may see who it was
        if (error instanceof InvalidStatusTransitionError) {
            const current = await TaskInstanceService.getTaskInstanceById(instanceId).catch((err) => {
                logger.error({ err }, 'Failed to load the already-completed task instance')
                return null
            })
            return instanceAlreadyCompletedResponse(current)
        }
        if (error instanceof InactiveTaskError) {
            return appErrorResponse(error, 409)
        }
        if (error instanceof InvalidPhotoError) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to complete task instance')
        return internalErrorResponse('Failed to complete task instance')
    }
}
