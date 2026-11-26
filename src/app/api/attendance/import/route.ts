import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { AttendanceService } from '@/services/attendance-service';
import { ImportAttendanceSchema } from '@/types/attendance-import';
import { InvalidImportFileError } from '@/lib/attendance-import';
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac';
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error';
import { UserNotFoundError } from '@/exceptions/user-not-found-error';
import { logger } from '@/lib/logger'
import { appErrorResponse, errorResponse, internalErrorResponse, validationErrorResponse } from '@/lib/error-response'

/**
 * POST /api/attendance/import — a clock-machine export (FR5 v1). multipart/form-data: `file`
 * plus `branch_id`; importer comes from the session. 201 even with per-row failures — the batch
 * still imports and errors ride along in the response, since one bad line shouldn't cost the rest.
 * Only an unreadable file is a 400.
 */
export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return errorResponse(400, 'INVALID_MULTIPART', 'Expected a multipart/form-data body');
    }

    const validationResult = ImportAttendanceSchema.safeParse({
        branch_id: formData.get('branch_id') ?? undefined,
    });

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error)
    }

    const file = formData.get('file');

    // a text field named `file` is not a file; require an actual upload
    if (!(file instanceof File)) {
        return errorResponse(400, 'VALIDATION_FAILED', 'file is required', { fields: [{ path: 'file', code: 'REQUIRED' }] });
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, validationResult.data.branch_id)

        const result = await AttendanceService.importAttendance({
            file,
            filters: { ...validationResult.data, imported_by: user.userId },
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof InvalidImportFileError) {
            return appErrorResponse(error, 400);
        }
        if (error instanceof BranchNotFoundError || error instanceof UserNotFoundError) {
            return appErrorResponse(error, 400);
        }
        logger.error({ err: error }, 'Failed to import attendance');
        return internalErrorResponse('Failed to import attendance');
    }
}
