import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { GuideFolderService } from '@/services/guide-folder-service'
import { GuideFolderRecord } from '@/repository/guide-folder-repository'
import { UpdateGuideFolderSchema } from '@/types/shelf-guide'
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error'
import { AccessTokenPayload } from '@/types/auth'

function requireFolderEdit(user: AccessTokenPayload, folder: GuideFolderRecord): void {
    requireGuideAccess(user, { branchId: folder.branchId, visibleToStaff: folder.view.isActive && folder.sectionActive }, GuideFolderNotFoundError, 'edit')
}

/** PATCH /api/folders/:id — name and position; deactivate is DELETE, reactivate is POST .../reactivate. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/folders/[folderId]'>
) {
    const folderId = parseNumericId((await ctx.params).folderId);

    if (folderId === null) {
        return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, UpdateGuideFolderSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireFolderEdit(user, await GuideFolderService.getFolder(folderId))
        const folder = await GuideFolderService.updateFolder(folderId, parsed.data);
        return NextResponse.json(folder, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to update folder');
    }
}

/** DELETE /api/folders/:id — deactivates it and every folder below it; their photos go to the recycle bin. */
export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/folders/[folderId]'>
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
        requireFolderEdit(user, await GuideFolderService.getFolder(folderId))
        await GuideFolderService.deactivateFolder(folderId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to deactivate folder');
    }
}
