import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { PhotoUploadView } from '@/types/task-instance'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { InactiveTaskError } from '@/exceptions/inactive-task-error'
import { logger } from '@/lib/logger'
import { instanceAlreadyCompletedResponse } from '@/lib/instance-completed-response'
import { appErrorResponse, internalErrorResponse, invalidIdResponse } from '@/lib/error-response'

/**
 * POST .../photo-upload — no body. Returns a short-lived signed URL the browser PUTs the compressed
 * photo to, plus the key to send to PATCH .../complete afterwards. Only someone who may complete
 * the instance gets one.
 */
export async function POST(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/photo-upload'>
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

    try {
        const { key, uploadUrl } = await TaskInstanceService.createPhotoUpload({
            instanceId,
            userId: user.userId,
        });

        const view: PhotoUploadView = { key, upload_url: uploadUrl };

        return NextResponse.json(view, { status: 200 })
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
        logger.error({ err: error }, 'Failed to create photo upload')
        return internalErrorResponse('Failed to create photo upload')
    }
}
