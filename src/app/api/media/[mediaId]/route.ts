import { NextRequest, NextResponse } from 'next/server'
import { MediaService } from '@/services/media-service'
import { TaskInstanceService } from '@/services/task-instance-service'
import { requireTaskInstanceAccess } from '@/lib/rbac'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

/** GET /api/media/:mediaId — metadata only; `file_path` isn't a servable URL yet (TO-BE-REVIEWED.md #1f). Same access rule as its parent task instance. */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/media/[mediaId]'>
) {
    const { mediaId: mediaIdParam } = await ctx.params;

    const mediaId = parseNumericId(mediaIdParam);

    if (mediaId === null) {
        return NextResponse.json({ error: 'Invalid mediaId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const media = await MediaService.getMediaById(mediaId);
        const instance = await TaskInstanceService.getTaskInstanceById(media.task_instance_id);

        if (instance) {
            requireTaskInstanceAccess(user, instance.task.branch_id, instance.assignee?.user_id)
        }

        return NextResponse.json(media, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof MediaNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to fetch media')
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
    }
}
