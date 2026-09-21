import { NextRequest, NextResponse } from 'next/server'
import { MediaService } from '@/services/media-service'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { getOrNotFound, parseNumericId } from '@/lib/route-utils'

/**
 * GET /api/task-instances/:instanceId/media — every photo on one occurrence, newest first.
 *
 * A non-existent instance is a 404; an existing one with no photos yet is a 200 with `[]` — the
 * two must not read the same, so the instance is checked before the media is listed.
 *
 * `GET /api/task-instances/:instanceId` already carries this same array under `media`. This
 * endpoint exists for a caller that wants only the photos — a gallery view, say — without paying
 * for the branch/assignee joins the full detail view carries.
 */
export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/media'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    const instanceId = parseNumericId(instanceIdParam);

    if (instanceId === null) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    return getOrNotFound(
        () => MediaService.getMediaForInstance(instanceId),
        TaskInstanceNotFoundError,
        'Failed to fetch media',
    );
}
