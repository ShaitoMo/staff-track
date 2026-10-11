import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { requireTaskInstanceAccess } from '@/lib/rbac'
import { logger } from '@/lib/logger'

/** GET /api/task-instances/:instanceId — owner unrestricted, manager their branches; staff if assigned by name, if they completed it, or if it targets their role at a branch they work at (see requireTaskInstanceAccess). */
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

        await requireTaskInstanceAccess(user, instance)

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
