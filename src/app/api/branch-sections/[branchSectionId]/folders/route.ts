import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse, queryFlag, queryFolderId } from '@/lib/guide-errors'
import { canEditGuide, requireGuideAccess } from '@/lib/rbac'
import { BranchSectionService } from '@/services/branch-section-service'
import { GuideFolderService } from '@/services/guide-folder-service'
import { CreateGuideFolderSchema } from '@/types/shelf-guide'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'

/**
 * GET .../folders?parentFolderId=&includeInactive=true — one level of folders; no parentFolderId = the section root.
 * GET .../folders?all=true — every active folder at any depth instead (parentFolderId is then ignored).
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]/folders'>
) {
    const branchSectionId = parseNumericId((await ctx.params).branchSectionId);
    const parentFolderId = queryFolderId(req.nextUrl, 'parentFolderId');

    if (branchSectionId === null || parentFolderId === undefined) {
        return NextResponse.json({ error: 'Invalid branchSectionId or parentFolderId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const section = await BranchSectionService.getSection(branchSectionId);
        requireGuideAccess(user, { branchId: section.branchId, visibleToStaff: section.isActive }, BranchSectionNotFoundError)

        if (queryFlag(req.nextUrl, 'all')) {
            return NextResponse.json(await GuideFolderService.getActiveTree(section), { status: 200 });
        }

        const editor = canEditGuide(user)
        const folders = await GuideFolderService.getFolders(section, parentFolderId, {
            includeInactive: queryFlag(req.nextUrl, 'includeInactive') && editor,
            visibleOnly: !editor,
        });
        return NextResponse.json(folders, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to fetch folders');
    }
}

export async function POST(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]/folders'>
) {
    const branchSectionId = parseNumericId((await ctx.params).branchSectionId);

    if (branchSectionId === null) {
        return NextResponse.json({ error: 'Invalid branchSectionId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, CreateGuideFolderSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const section = await BranchSectionService.getSection(branchSectionId);
        requireGuideAccess(user, { branchId: section.branchId, visibleToStaff: section.isActive }, BranchSectionNotFoundError, 'edit')
        const folder = await GuideFolderService.createFolder(section, parsed.data);
        return NextResponse.json(folder, { status: 201 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to create folder');
    }
}
