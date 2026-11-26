import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { AttendanceService } from '@/services/attendance-service';
import { UpdateAttendanceSchema } from '@/types/attendance';
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac';
import { DuplicateAttendanceError } from '@/exceptions/duplicate-attendance-error';
import { InvalidAttendanceTimesError } from '@/exceptions/invalid-attendance-times-error';
import { logger } from '@/lib/logger'
import { appErrorResponse, errorResponse, internalErrorResponse, invalidIdResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

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
        return invalidIdResponse('attendanceId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return invalidJsonResponse();
    }

    // named one by one, which keeps user, branch and source out of an edit
    const validationResult = UpdateAttendanceSchema.safeParse({
        clock_in: body?.clock_in,
        clock_out: body?.clock_out,
    });

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])

        const existing = await AttendanceService.getAttendanceById(attendanceId);

        if (!existing) {
            return errorResponse(404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found');
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
            return appErrorResponse(error, 422);
        }
        if (error instanceof DuplicateAttendanceError) {
            return appErrorResponse(error, 409);
        }
        logger.error({ err: error }, 'Failed to update attendance');
        return internalErrorResponse('Failed to update attendance');
    }
}
