import { NextRequest, NextResponse } from 'next/server'
import { requireMediaAccess } from '@/lib/media-access'
import { getPhotoViewUrl, photoExists } from '@/lib/storage'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { openedAsPage, photoUnavailableRedirect } from '@/lib/photo-unavailable'
import { appErrorResponse, internalErrorResponse, invalidIdResponse } from '@/lib/error-response'

/**
 * GET /api/media/:mediaId/file — the photo itself. Same access rule as its parent task instance;
 * once that passes, redirects to a short-lived signed URL on the private bucket.
 *
 * The "view photo" link opens this in a new tab, where a JSON error or R2's XML 404 would be all the
 * person sees. So when the browser loads it as a page (not as an <img>), a refused or missing photo
 * redirects to the translated /photo-unavailable page instead. Only then is the bucket checked for
 * the file: an <img> load falls back to PhotoImage's tile on its own, and skipping the check keeps
 * it fast.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/media/[mediaId]/file'>
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

    const asPage = openedAsPage(req);

    try {
        const media = await requireMediaAccess(user, mediaId);

        if (asPage && !(await photoExists(media.file_path))) {
            return photoUnavailableRedirect(req);
        }

        const res = NextResponse.redirect(await getPhotoViewUrl(media.file_path), 302);

        // the signed URL is per-request: never cache the redirect, so a revoked user re-runs the access check
        res.headers.set('Cache-Control', 'no-store');
        return res;
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        const notFound = error instanceof MediaNotFoundError || error instanceof TaskInstanceNotFoundError;

        if ((forbidden || notFound) && asPage) {
            return photoUnavailableRedirect(req);
        }
        if (forbidden) {
            return forbidden;
        }
        if (notFound) {
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to serve photo')
        return internalErrorResponse('Failed to serve photo')
    }
}
