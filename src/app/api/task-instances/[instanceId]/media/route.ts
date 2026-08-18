import { NextRequest, NextResponse } from 'next/server'
import { MediaService } from '@/services/media-service'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'

/**
 * GET /api/task-instances/:instanceId/media — every photo on one occurrence, newest first.
 *
 * A non-existent instance is a 404; an existing one with no photos yet is a 200 with `[]` — the
 * two must not read the same, so the instance is checked before the media is listed.
 */
export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/media'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    try {
        const media = await MediaService.getMediaForInstance(Number(instanceIdParam));
        return NextResponse.json(media, { status: 200 });
    } catch (error) {
        if (error instanceof TaskInstanceNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
    }
}
