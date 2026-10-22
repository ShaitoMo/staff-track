import { NextRequest, NextResponse } from 'next/server'
import { TaskInstanceService } from '@/services/task-instance-service'
import { GuideImageService } from '@/services/guide-image-service'
import { requireTaskInstanceAccess } from '@/lib/rbac'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

/**
 * GET /api/task-instances/:instanceId/reference — the shelf-guide photos showing how the task should
 * look, `[]` when it has no reference. Same access as GET .../:instanceId, and nothing more: a photo
 * hidden in the guide (inactive section or folder) still shows here, because the task is the reason
 * the worker needs it.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/reference'>
) {
    const instanceId = parseNumericId((await ctx.params).instanceId);

    if (instanceId === null) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const instance = await TaskInstanceService.getTaskInstanceById(instanceId);

        if (!instance) {
            return NextResponse.json({ error: 'Task instance not found' }, { status: 404 });
        }

        await requireTaskInstanceAccess(user, instance)

        const reference = instance.task.reference
        const images = reference === null ? [] : await GuideImageService.getTaskReferenceImages(reference, instanceId)
        return NextResponse.json(images, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch task reference')
        return NextResponse.json({ error: 'Failed to fetch task reference' }, { status: 500 })
    }
}
