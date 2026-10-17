import { NextRequest, NextResponse } from 'next/server'
import { requireMediaAccess } from '@/lib/media-access'
import { getPhotoViewUrl } from '@/lib/storage'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

/**
 * GET /api/media/:mediaId/file — the photo itself. Same access rule as its parent task instance;
 * once that passes, redirects to a short-lived signed URL on the private bucket.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/media/[mediaId]/file'>
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
        const media = await requireMediaAccess(user, mediaId);
        const res = NextResponse.redirect(await getPhotoViewUrl(media.file_path), 302);

        // the signed URL is per-request: never cache the redirect, so a revoked user re-runs the access check
        res.headers.set('Cache-Control', 'no-store');
        return res;
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof MediaNotFoundError || error instanceof TaskInstanceNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to serve photo')
        return NextResponse.json({ error: 'Failed to serve photo' }, { status: 500 })
    }
}
