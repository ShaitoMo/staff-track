import { NextRequest, NextResponse } from 'next/server'
import { MediaService } from '@/services/media-service'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'
import { getOrNotFound, parseNumericId } from '@/lib/route-utils'

/**
 * GET /api/media/:mediaId — one media record: metadata plus its stored file path.
 *
 * `file_path` is a storage reference, not a servable URL — `uploads/` sits outside `public/` so
 * nothing serves the file itself yet (see TO-BE-REVIEWED.md #1f). This is the metadata half only.
 */
export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/media/[mediaId]'>
) {
    const { mediaId: mediaIdParam } = await ctx.params;

    const mediaId = parseNumericId(mediaIdParam);

    if (mediaId === null) {
        return NextResponse.json({ error: 'Invalid mediaId' }, { status: 400 });
    }

    return getOrNotFound(
        () => MediaService.getMediaById(mediaId),
        MediaNotFoundError,
        'Failed to fetch media',
    );
}
