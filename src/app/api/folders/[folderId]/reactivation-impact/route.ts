import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { GuideFolderService } from '@/services/guide-folder-service'
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error'

/** GET .../reactivation-impact — what reactivation would touch, counted before anything changes. */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/folders/[folderId]/reactivation-impact'>
) {
    const folderId = parseNumericId((await ctx.params).folderId);

    if (folderId === null) {
        return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const folder = await GuideFolderService.getFolder(folderId);
        requireGuideAccess(user, { branchId: folder.branchId, visibleToStaff: folder.view.isActive && folder.sectionActive }, GuideFolderNotFoundError, 'edit')
        const impact = await GuideFolderService.getReactivationImpact(folderId);
        return NextResponse.json(impact, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to count reactivation impact');
    }
}
