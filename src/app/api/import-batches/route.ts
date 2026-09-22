import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { AttendanceService } from '@/services/attendance-service';
import { MANAGER_ROLE, OWNER_ROLE, requireRole } from '@/lib/rbac'
import { logger } from '@/lib/logger'

/** GET /api/import-batches — newest first. Role-gated only, no requireBranchAccess: ImportBatch names no branch. */
export async function GET(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        const batches = await AttendanceService.getImportBatches();
        return NextResponse.json(batches, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        logger.error({ err: error }, 'Failed to fetch import batches');
        return NextResponse.json({ error: 'Failed to fetch import batches' }, { status: 500 });
    }
}
