import { NextRequest, NextResponse } from 'next/server'
import { MediaService } from '@/services/media-service'
import { TaskInstanceService } from '@/services/task-instance-service'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { logger } from '@/lib/logger'

/** GET /api/task-instances/:instanceId/media — newest first; 404 vs empty `[]` kept distinct. Same access rule as GET .../:instanceId. */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/media'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    const instanceId = Number(instanceIdParam)

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        const instance = await TaskInstanceService.getTaskInstanceById(instanceId);

        if (!instance) {
            return NextResponse.json({ error: 'Task instance not found' }, { status: 404 })
        }

        if (user.role === OWNER_ROLE) {
            // no branch check
        } else if (user.role === MANAGER_ROLE) {
            requireBranchAccess(user, instance.task.branch_id)
        } else if (instance.assignee?.user_id !== user.userId) {
            return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
        }

        const media = await MediaService.getMediaForInstance(instanceId);
        return NextResponse.json(media, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof TaskInstanceNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to fetch media');
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
    }
}
