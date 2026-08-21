import { NextRequest, NextResponse } from 'next/server'
import { AttendanceService } from '@/services/attendance-service'
import { AttendanceFiltersSchema, CreateAttendanceSchema } from '@/types/attendance'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error'
import { DuplicateAttendanceError } from '@/exceptions/duplicate-attendance-error'
import { logger } from '@/lib/logger'


export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams

    const validationResult = AttendanceFiltersSchema.safeParse({
        user_id: searchParams.get('user_id') ?? undefined,
        branch_id: searchParams.get('branch_id') ?? undefined,
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

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])

        if (validationResult.data.branch_id !== undefined) {
            requireBranchAccess(user, validationResult.data.branch_id)
        }

        const attendance = await AttendanceService.getAttendance(validationResult.data)
        const visible = user.role === OWNER_ROLE
            ? attendance
            : attendance.filter((row) => user.branchIds.includes(row.branch_id))

        return NextResponse.json(visible, { status: 200 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        logger.error({ err: error }, 'Failed to fetch attendance');
        return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
    }
}

/**
 * POST /api/attendance — records a punch by hand, for a clock-in the machine missed.
 *
 * The row is always `source: manual` with no import batch; those two are set by the server, not
 * the client. A punch already recorded for this user at this instant is a 409: nothing about the
 * request is malformed, it has simply been entered before.
 */
export async function POST(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = CreateAttendanceSchema.safeParse(body);

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, validationResult.data.branch_id)
        const attendance = await AttendanceService.createAttendance(validationResult.data);
        return NextResponse.json(attendance, { status: 201 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof DuplicateAttendanceError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (error instanceof BranchNotFoundError || error instanceof UserNotAtBranchError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to create attendance');
        return NextResponse.json({ error: 'Failed to create attendance' }, { status: 500 })
    }
}
