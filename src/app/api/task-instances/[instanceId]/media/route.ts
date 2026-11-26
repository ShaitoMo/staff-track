import { NextRequest, NextResponse } from 'next/server'
import { MediaService } from '@/services/media-service'
import { TaskInstanceService } from '@/services/task-instance-service'
import { requireTaskInstanceAccess } from '@/lib/rbac'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse } from '@/lib/error-response'

/** GET /api/task-instances/:instanceId/media — newest first; 404 vs empty `[]` kept distinct. Same access rule as GET .../:instanceId, which already carries this array — this is for a caller that wants only the photos. */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/media'>
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
        const instance = await TaskInstanceService.getTaskInstanceById(instanceId);

        if (!instance) {
            return appErrorResponse(new TaskInstanceNotFoundError(), 404)
        }

        await requireTaskInstanceAccess(user, instance)

        const media = await MediaService.getMediaForInstance(instanceId);
        return NextResponse.json(media, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof TaskInstanceNotFoundError) {
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to fetch media')
        return internalErrorResponse('Failed to fetch media')
    }
}
