import { NextRequest, NextResponse } from 'next/server';
import { AttendanceService } from '@/services/attendance-service';
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'

/** GET /api/import-batches — newest first. Role-gated only, no requireBranchAccess: ImportBatch names no branch. */
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
