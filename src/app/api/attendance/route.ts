import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { AttendanceService } from '@/services/attendance-service';
import { AttendanceFiltersSchema, CreateAttendanceSchema } from '@/types/attendance';
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac';
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error';
import { UserNotAtBranchError } from '@/exceptions/user-not-at-branch-error';
import { DuplicateAttendanceError } from '@/exceptions/duplicate-attendance-error';
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;

    const validationResult = AttendanceFiltersSchema.safeParse({
        user_id: searchParams.get('user_id') ?? undefined,
        branch_id: searchParams.get('branch_id') ?? undefined,
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
    });

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error)
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE]);

        if (validationResult.data.branch_id !== undefined) {
            requireBranchAccess(user, validationResult.data.branch_id);
        }

        const attendance = await AttendanceService.getAttendance(validationResult.data);
        const visible = user.role === OWNER_ROLE
            ? attendance
            : attendance.filter((row) => user.branchIds.includes(row.branch_id));

        return NextResponse.json(visible, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch attendance');
        return internalErrorResponse('Failed to fetch attendance');
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

    const validationResult = CreateAttendanceSchema.safeParse(body);

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, validationResult.data.branch_id)
        const attendance = await AttendanceService.createAttendance(validationResult.data);
        return NextResponse.json(attendance, { status: 201 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof DuplicateAttendanceError) {
            return appErrorResponse(error, 409);
        }
        if (error instanceof BranchNotFoundError || error instanceof UserNotAtBranchError) {
            return appErrorResponse(error, 400);
        }
        logger.error({ err: error }, 'Failed to create attendance');
        return internalErrorResponse('Failed to create attendance');
    }
}
