import { NextRequest, NextResponse } from 'next/server'
import { TaskInstanceService } from '@/services/task-instance-service'

/** GET /api/task-instances/:instanceId — one instance with all of its media, newest first. */
export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    try {
        const instance = await TaskInstanceService.getTaskInstanceById(Number(instanceIdParam));

        if (!instance) {
            return NextResponse.json({ error: 'Task instance not found' }, { status: 404 });
        }

        return NextResponse.json(instance, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch task instance' }, { status: 500 })
    }
}
