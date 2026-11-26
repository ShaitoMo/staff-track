import { NextRequest, NextResponse } from 'next/server'
import { requireMediaAccess } from '@/lib/media-access'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse } from '@/lib/error-response'

/** GET /api/media/:mediaId — metadata only; the bytes are at .../file. Same access rule as its parent task instance. */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/media/[mediaId]'>
) {
    const { mediaId: mediaIdParam } = await ctx.params;

    const mediaId = parseNumericId(mediaIdParam);

    if (mediaId === null) {
        return invalidIdResponse('mediaId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const media = await requireMediaAccess(user, mediaId);

        return NextResponse.json(media, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof MediaNotFoundError || error instanceof TaskInstanceNotFoundError) {
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to fetch media')
        return internalErrorResponse('Failed to fetch media')
    }
}
