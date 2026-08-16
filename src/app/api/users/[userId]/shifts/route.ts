import { NextRequest, NextResponse } from 'next/server'
import { ShiftService } from '@/services/shift-service'
import { UserShiftFiltersSchema } from '@/types/shift'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'

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
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const userId = Number(userIdParam);

    const searchParams = req.nextUrl.searchParams

    const validationResult = UserShiftFiltersSchema.safeParse({
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
    })

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const shifts = await ShiftService.getShiftsForUser(userId, validationResult.data);
        return NextResponse.json(shifts, { status: 200 });
    } catch (error) {
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
    }
}
