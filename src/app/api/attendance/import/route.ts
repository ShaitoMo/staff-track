import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { AttendanceService } from '@/services/attendance-service';
import { ImportAttendanceSchema } from '@/types/attendance-import';
import { InvalidImportFileError } from '@/lib/attendance-import';
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac';
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error';
import { UserNotFoundError } from '@/exceptions/user-not-found-error';

/**
 * POST /api/attendance/import — a clock-machine export (FR5 v1).
 *
 * multipart/form-data: `file` (the CSV/Excel export) plus `branch_id`. Importer comes from the session.
 *
 * 201 even when rows inside the file failed: the batch was created and the response carries the
 * per-row errors, because a manager fixing three bad lines out of four hundred needs the other
 * 397 imported. Only an unreadable file is a 400.
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
        return NextResponse.json(
            { error: 'Expected a multipart/form-data body' },
            { status: 400 },
        );
    }

    const validationResult = ImportAttendanceSchema.safeParse({
        branch_id: formData.get('branch_id') ?? undefined,
    });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));
        return NextResponse.json({ error: errors }, { status: 400 });
    }

    const file = formData.get('file');

    // a text field named `file` is not a file; require an actual upload
    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
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
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error instanceof BranchNotFoundError || error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to import attendance' }, { status: 500 });
    }
}
