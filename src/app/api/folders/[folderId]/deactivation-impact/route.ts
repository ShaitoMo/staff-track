import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { GuideFolderService } from '@/services/guide-folder-service'
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error'

/** GET .../deactivation-impact — what deactivation would touch, counted before anything changes. */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/folders/[folderId]/deactivation-impact'>
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
        requireGuideAccess(user, folder, GuideFolderNotFoundError, 'edit')
        const impact = await GuideFolderService.getDeactivationImpact(folderId);
        return NextResponse.json(impact, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to count deactivation impact');
    }
}
