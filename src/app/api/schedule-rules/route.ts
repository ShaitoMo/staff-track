import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse, parseJsonBody, zodErrorResponse } from '@/lib/route-utils'
import { ScheduleRuleService } from '@/services/schedule-rule-service'
import { SaveScheduleRulesSchema, ScheduleRulesQuerySchema } from '@/types/schedule-builder'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { ShiftPeriodNotAtBranchError } from '@/exceptions/shift-period-not-at-branch-error'
import { logger } from '@/lib/logger'

/** GET /api/schedule-rules?branchId= — the branch's scheduling rules (keep-apart pairs and period limits). */
export async function GET(req: NextRequest) {
    const query = ScheduleRulesQuerySchema.safeParse({
        branchId: req.nextUrl.searchParams.get('branchId') ?? undefined,
    })

    if (!query.success) {
        return zodErrorResponse(query.error)
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, query.data.branchId)
        const rules = await ScheduleRuleService.getRules(query.data.branchId)
        return NextResponse.json(rules, { status: 200 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to fetch scheduling rules')
        return NextResponse.json({ error: 'Failed to fetch scheduling rules' }, { status: 500 })
    }
}

/** PUT /api/schedule-rules — replaces the branch's whole rule set and answers with it as saved. */
export async function PUT(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, SaveScheduleRulesSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, parsed.data.branchId)
        const rules = await ScheduleRuleService.replaceRules(parsed.data)
        return NextResponse.json(rules, { status: 200 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (
            error instanceof BranchNotFoundError ||
            error instanceof UserNotAtBranchError ||
            error instanceof ShiftPeriodNotAtBranchError
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to save scheduling rules')
        return NextResponse.json({ error: 'Failed to save scheduling rules' }, { status: 500 })
    }
}
