import { NextRequest, NextResponse } from 'next/server'
import { TaskInstanceService } from '@/services/task-instance-service'
import { TaskInstanceFiltersSchema } from '@/types/task-instance'

/**
 * GET /api/task-instances?user_id=&date=&branch_id=&status=
 *
 * The worker's daily list. Every filter is optional and they combine with AND.
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

    try {
        const instances = await TaskInstanceService.getTaskInstances(validationResult.data)
        return NextResponse.json(instances, { status: 200 })
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch task instances' }, { status: 500 })
    }
}
