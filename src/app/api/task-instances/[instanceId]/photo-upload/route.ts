import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { PhotoUploadView } from '@/types/task-instance'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { InactiveTaskError } from '@/exceptions/inactive-task-error'
import { logger } from '@/lib/logger'

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
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
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
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof InvalidStatusTransitionError || error instanceof InactiveTaskError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        logger.error({ err: error }, 'Failed to create photo upload')
        return NextResponse.json({ error: 'Failed to create photo upload' }, { status: 500 })
    }
}
