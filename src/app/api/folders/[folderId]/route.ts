import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { GuideFolderService } from '@/services/guide-folder-service'
import { GuideFolderRecord } from '@/repository/guide-folder-repository'
import { UpdateGuideFolderSchema } from '@/types/shelf-guide'
import { GuideFolderNotFoundError } from '@/exceptions/guide-folder-not-found-error'
import { AccessTokenPayload } from '@/types/auth'

function requireFolderAccess(user: AccessTokenPayload, folder: GuideFolderRecord, mode: 'read' | 'edit'): void {
    requireGuideAccess(user, folder, GuideFolderNotFoundError, mode)
}

export async function GET(
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
        const folder = await GuideFolderService.getFolder(folderId);
        requireFolderAccess(user, folder, 'read')
        return NextResponse.json(folder.view, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to fetch folder');
    }
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
        requireFolderAccess(user, await GuideFolderService.getFolder(folderId), 'edit')
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
        requireFolderAccess(user, await GuideFolderService.getFolder(folderId), 'edit')
        await GuideFolderService.deactivateFolder(folderId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to deactivate folder');
    }
}
