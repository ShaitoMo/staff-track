import { NextRequest, NextResponse } from 'next/server'
import { TaskInstanceService } from '@/services/task-instance-service'
import { TaskInstanceFiltersSchema } from '@/types/task-instance'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'

/**
 * GET /api/task-instances?user_id=&date=&branch_id=&status=
 *
 * The worker's daily list. Every filter is optional and they combine with AND.
 *
 * Staff (anyone who isn't owner/manager) can only ever see their own instances — user_id is forced
 * to the caller's own id regardless of what the query asked for, rather than 403ing on a mismatch,
 * since "show me my list" is the normal request this endpoint serves for that role. A manager is
 * scoped to their own branches; owner is unrestricted.
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams

    const validationResult = TaskInstanceFiltersSchema.safeParse({
        user_id: searchParams.get('user_id') ?? undefined,
        branch_id: searchParams.get('branch_id') ?? undefined,
        date: searchParams.get('date') ?? undefined,
        status: searchParams.get('status') ?? undefined,
    })

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const isElevated = user.role === OWNER_ROLE || user.role === MANAGER_ROLE
    const filters = isElevated
        ? validationResult.data
        : { ...validationResult.data, user_id: user.userId }

    try {
        if (isElevated && user.role !== OWNER_ROLE && filters.branch_id !== undefined) {
            requireBranchAccess(user, filters.branch_id)
        }

        const instances = await TaskInstanceService.getTaskInstances(filters)

        const visible = !isElevated || user.role === OWNER_ROLE
            ? instances
            : instances.filter((instance) => user.branchIds.includes(instance.task.branch_id))

        return NextResponse.json(visible, { status: 200 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch task instances' }, { status: 500 })
    }
}
