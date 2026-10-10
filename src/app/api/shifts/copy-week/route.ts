import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseJsonBody } from '@/lib/route-utils'
import { ShiftService } from '@/services/shift-service'
import { CopyWeekSchema } from '@/types/shift'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { logger } from '@/lib/logger'

/**
 * POST /api/shifts/copy-week — copies the branch's previous week onto the week starting at
 * `week_start`. Shifts that would clash or whose person has left the branch are skipped and
 * counted, not refused, so the response is always `{ created, skipped }`.
 */
export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, CopyWeekSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, parsed.data.branch_id)
        const result = await ShiftService.copyWeek({ ...parsed.data, created_by: user.userId });
        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to copy week')
        return NextResponse.json({ error: 'Failed to copy week' }, { status: 500 })
    }
}
