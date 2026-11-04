import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseJsonBody } from '@/lib/route-utils'
import { ScheduleBuilderService } from '@/services/schedule-builder-service'
import { ApproveScheduleSchema } from '@/types/schedule-builder'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { logger } from '@/lib/logger'

/**
 * POST /api/schedule-builder/approve — saves the proposal the manager kept as ordinary shifts.
 * Rows that no longer hold are skipped and counted, so the response is always `{ created, skipped }`.
 */
export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, ApproveScheduleSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, parsed.data.branchId)
        const result = await ScheduleBuilderService.approve({ ...parsed.data, createdBy: user.userId });
        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to approve a schedule')
        return NextResponse.json({ error: 'Failed to approve a schedule' }, { status: 500 })
    }
}
