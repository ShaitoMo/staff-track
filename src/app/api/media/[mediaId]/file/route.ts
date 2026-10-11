import { NextRequest, NextResponse } from 'next/server'
import { requireMediaAccess } from '@/lib/media-access'
import { PhotoNotFoundError, readPhoto } from '@/lib/storage'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

/** GET /api/media/:mediaId/file — the photo itself. Same access rule as its parent task instance. */
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
        const { data, contentType } = await readPhoto(media.file_path);

        return new NextResponse(new Uint8Array(data), {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(data.length),
                // a photo is private to whoever may see the instance: no shared caches, and no-cache
                // makes the browser recheck access on every view, so a revoked user is not served from
                // their own cache; the browser also must not second-guess the type we declare
                'Cache-Control': 'private, no-cache',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (
            error instanceof MediaNotFoundError ||
            error instanceof TaskInstanceNotFoundError ||
            error instanceof PhotoNotFoundError
        ) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to serve photo')
        return NextResponse.json({ error: 'Failed to serve photo' }, { status: 500 })
    }
}
