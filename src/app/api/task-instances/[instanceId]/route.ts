import { NextRequest, NextResponse } from 'next/server'
import { TaskInstanceService } from '@/services/task-instance-service'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'

/**
 * GET /api/task-instances/:instanceId — one instance with all of its media, newest first.
 *
 * Owner: unrestricted. Manager: their own branches. Staff: only an instance directly assigned to
 * them by name — a role-targeted (unclaimed) instance is visible through the list endpoint's
 * role-matching but not by id here, a narrower rule than the list's, kept simple deliberately.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        const instance = await TaskInstanceService.getTaskInstanceById(Number(instanceIdParam));

        if (!instance) {
            return NextResponse.json({ error: 'Task instance not found' }, { status: 404 });
        }

        if (user.role === OWNER_ROLE) {
            return NextResponse.json(instance, { status: 200 });
        }

        if (user.role === MANAGER_ROLE) {
            requireBranchAccess(user, instance.task.branch_id)
            return NextResponse.json(instance, { status: 200 });
        }

        if (instance.assignee?.user_id !== user.userId) {
            return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
        }

        return NextResponse.json(instance, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch task instance' }, { status: 500 })
    }
}
