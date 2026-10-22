import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { GuideFolderService } from '@/services/guide-folder-service'
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error'

/** POST .../reactivate — the folder and its subtree come back, photos and all (409 while its section or parent is inactive). */
export async function POST(
    req: NextRequest,
    ctx: RouteContext<'/api/folders/[folderId]/reactivate'>
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
        const result = await GuideFolderService.reactivateFolder(folder);
        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to reactivate folder');
    }
}
