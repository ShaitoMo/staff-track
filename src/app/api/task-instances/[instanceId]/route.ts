import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { requireTaskInstanceAccess } from '@/lib/rbac'
import { logger } from '@/lib/logger'

/** GET /api/task-instances/:instanceId — owner unrestricted, manager their branches, staff only if directly assigned by name (narrower than the list's role-matching). */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const instance = await TaskInstanceService.getTaskInstanceById(Number(instanceIdParam));

        if (!instance) {
            return NextResponse.json({ error: 'Task instance not found' }, { status: 404 });
        }

        requireTaskInstanceAccess(user, instance.task.branch_id, instance.assignee?.user_id)

        return NextResponse.json(instance, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch task instance')
        return NextResponse.json({ error: 'Failed to fetch task instance' }, { status: 500 })
    }
}
