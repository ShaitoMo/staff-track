import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { ShiftService } from '@/services/shift-service'
import { UserShiftFiltersSchema } from '@/types/shift'
import { MANAGER_ROLE, OWNER_ROLE, requireSelfOrRole } from '@/lib/rbac'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse, validationErrorResponse } from '@/lib/error-response'

/**
 * GET /api/users/:userId/shifts?from=&to=
 *
 * One user's shifts across all their branches. Both bounds are optional and inclusive.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/shifts'>
) {
    const { userId: userIdParam } = await ctx.params;

    if (!/^\d+$/.test(userIdParam)) {
        return invalidIdResponse('userId');
    }

    const userId = Number(userIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const searchParams = req.nextUrl.searchParams

    const validationResult = UserShiftFiltersSchema.safeParse({
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
    })

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error)
    }

    try {
        requireSelfOrRole(user, userId, [OWNER_ROLE, MANAGER_ROLE])
        const shifts = await ShiftService.getShiftsForUser(userId, validationResult.data);
        return NextResponse.json(shifts, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof UserNotFoundError) {
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to fetch shifts');
        return internalErrorResponse('Failed to fetch shifts');
    }
}
