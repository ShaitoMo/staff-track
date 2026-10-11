import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { AttendanceService } from '@/services/attendance-service';
import { UpdateAttendanceSchema } from '@/types/attendance';
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac';
import { DuplicateAttendanceError } from '@/exceptions/duplicate-attendance-error';
import { InvalidAttendanceTimesError } from '@/exceptions/invalid-attendance-times-error';
import { logger } from '@/lib/logger'

/**
 * PATCH /api/attendance/:attendanceId — fills in or corrects either end of a punch, usually the
 * clock-in or clock-out the machine missed. A clock-out not after the clock-in is a 422: the body
 * is well-formed, but the punch it would leave cannot exist. Landing on another recorded punch's
 * time is a 409, as on POST.
 */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/attendance/[attendanceId]'>
) {
    const { attendanceId: attendanceIdParam } = await ctx.params;

    const attendanceId = parseNumericId(attendanceIdParam);

    if (attendanceId === null) {
        return NextResponse.json({ error: 'Invalid attendanceId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // named one by one, which keeps user, branch and source out of an edit
    const validationResult = UpdateAttendanceSchema.safeParse({
        clock_in: body?.clock_in,
        clock_out: body?.clock_out,
    });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        return NextResponse.json({ error: errors }, { status: 400 });
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])

        const existing = await AttendanceService.getAttendanceById(attendanceId);

        if (!existing) {
            return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
        }

        requireBranchAccess(user, existing.branch_id)

        const attendance = await AttendanceService.updateAttendance(existing, validationResult.data);
        return NextResponse.json(attendance, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof InvalidAttendanceTimesError) {
            return NextResponse.json({ error: error.message }, { status: 422 });
        }
        if (error instanceof DuplicateAttendanceError) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        logger.error({ err: error }, 'Failed to update attendance');
        return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 });
    }
}
