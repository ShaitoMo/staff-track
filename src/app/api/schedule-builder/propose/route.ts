import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseJsonBody } from '@/lib/route-utils'
import { ScheduleBuilderService } from '@/services/schedule-builder-service'
import { ProposeScheduleSchema } from '@/types/schedule-builder'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { SchedulerUnavailableError } from '@/exceptions/scheduler-unavailable-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, errorResponse, internalErrorResponse } from '@/lib/error-response'

/**
 * POST /api/schedule-builder/propose — the auto-scheduler's suggestion for the branch's open
 * coverage in the week from `weekStart`. A POST because it computes, not because it writes:
 * nothing is saved until /approve.
 */
export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, ProposeScheduleSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, parsed.data.branchId)
        const proposal = await ScheduleBuilderService.propose(parsed.data);
        return NextResponse.json(proposal)
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return appErrorResponse(error, 400)
        }
        if (error instanceof SchedulerUnavailableError) {
            return errorResponse(503, 'SOLVER_UNAVAILABLE', error.message)
        }
        logger.error({ err: error }, 'Failed to propose a schedule')
        return internalErrorResponse('Failed to propose a schedule')
    }
}
