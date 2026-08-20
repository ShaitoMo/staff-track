import { NextRequest, NextResponse } from 'next/server';
import { AttendanceService } from '@/services/attendance-service';
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'

/**
 * GET /api/import-batches — every clock-machine upload, newest first. Not branch-scoped: a batch
 * records who uploaded a file and when, not which branch it covered (nothing on ImportBatch names
 * one), so this is gated by role only rather than filtered by requireBranchAccess.
 */
export async function GET(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        const batches = await AttendanceService.getImportBatches();
        return NextResponse.json(batches, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch import batches' }, { status: 500 });
    }
}
