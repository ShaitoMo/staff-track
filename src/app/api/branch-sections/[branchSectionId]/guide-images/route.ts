import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse, queryFolderId } from '@/lib/guide-errors'
import { canEditGuide, requireGuideAccess } from '@/lib/rbac'
import { BranchSectionService } from '@/services/branch-section-service'
import { GuideImageService } from '@/services/guide-image-service'
import { CreateGuideImageSchema } from '@/types/shelf-guide'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'

/** GET .../guide-images?folderId= — the photos at one level, in order; no folderId = the section root. */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]/guide-images'>
) {
    const branchSectionId = parseNumericId((await ctx.params).branchSectionId);
    const folderId = queryFolderId(req.nextUrl, 'folderId');

    if (branchSectionId === null || folderId === undefined) {
        return NextResponse.json({ error: 'Invalid branchSectionId or folderId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const section = await BranchSectionService.getSection(branchSectionId);
        requireGuideAccess(user, { branchId: section.branchId, visibleToStaff: section.isActive }, BranchSectionNotFoundError)
        const images = await GuideImageService.getImages(section, folderId, !canEditGuide(user));
        return NextResponse.json(images.map(image => image.view), { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to fetch photos');
    }
}

/** POST .../guide-images — step two of an upload: confirm the keys photo-upload issued once both PUTs are done. */
export async function POST(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]/guide-images'>
) {
    const branchSectionId = parseNumericId((await ctx.params).branchSectionId);

    if (branchSectionId === null) {
        return NextResponse.json({ error: 'Invalid branchSectionId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, CreateGuideImageSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const section = await BranchSectionService.getSection(branchSectionId);
        requireGuideAccess(user, { branchId: section.branchId, visibleToStaff: section.isActive }, BranchSectionNotFoundError, 'edit')
        const image = await GuideImageService.createImage(section, parsed.data, user.userId);
        return NextResponse.json(image.view, { status: 201 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to add photo');
    }
}
