import { NextRequest, NextResponse } from 'next/server'
import { MediaService } from '@/services/media-service'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'

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

    if (!/^\d+$/.test(mediaIdParam)) {
        return NextResponse.json({ error: 'Invalid mediaId' }, { status: 400 });
    }

    try {
        const media = await MediaService.getMediaById(Number(mediaIdParam));
        return NextResponse.json(media, { status: 200 });
    } catch (error) {
        if (error instanceof MediaNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
    }
}
