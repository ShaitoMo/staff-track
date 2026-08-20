import { NextRequest, NextResponse } from 'next/server'
import { MediaService } from '@/services/media-service'
import { TaskInstanceService } from '@/services/task-instance-service'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { MediaNotFoundError } from '@/exceptions/media-not-found-error'

/**
 * GET /api/media/:mediaId — one media record: metadata plus its stored file path.
 *
 * `file_path` is a storage reference, not a servable URL — `uploads/` sits outside `public/` so
 * nothing serves the file itself yet (see TO-BE-REVIEWED.md #1f). This is the metadata half only.
 * Same owner/manager/assignee access rule as its parent task instance.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/media/[mediaId]'>
) {
    const { mediaId: mediaIdParam } = await ctx.params;

    if (!/^\d+$/.test(mediaIdParam)) {
        return NextResponse.json({ error: 'Invalid mediaId' }, { status: 400 });
    }

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        const media = await MediaService.getMediaById(Number(mediaIdParam));
        const instance = await TaskInstanceService.getTaskInstanceById(media.task_instance_id);

        if (instance) {
            if (user.role === OWNER_ROLE) {
                // no branch check
            } else if (user.role === MANAGER_ROLE) {
                requireBranchAccess(user, instance.task.branch_id)
            } else if (instance.assignee?.user_id !== user.userId) {
                return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
            }
        }

        return NextResponse.json(media, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof MediaNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
    }
}
