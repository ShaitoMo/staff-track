import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse, queryFolderId } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { BranchSectionService } from '@/services/branch-section-service'
import { GuideImageService } from '@/services/guide-image-service'
import { ReorderGuideImagesSchema } from '@/types/shelf-guide'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'

/** PUT .../guide-images/order?folderId= — body lists exactly the live photos at that level, in their new order. */
export async function PUT(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]/guide-images/order'>
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

    const parsed = await parseJsonBody(req, ReorderGuideImagesSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const section = await BranchSectionService.getSection(branchSectionId);
        requireGuideAccess(user, { branchId: section.branchId, visibleToStaff: section.isActive }, BranchSectionNotFoundError, 'edit')
        const images = await GuideImageService.reorderImages(section, folderId, parsed.data.imageIds);
        return NextResponse.json(images.map(image => image.view), { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to reorder photos');
    }
}
