import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { BranchSectionService } from '@/services/branch-section-service'
import { GuideImageService } from '@/services/guide-image-service'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'

/**
 * POST .../guide-images/photo-upload — no body. Step one of adding or replacing a photo: signed PUT
 * URLs for the JPEG and its thumbnail, plus the keys to send to POST .../guide-images or PATCH
 * /api/guide-images/:id afterwards.
 */
export async function POST(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]/guide-images/photo-upload'>
) {
    const branchSectionId = parseNumericId((await ctx.params).branchSectionId);

    if (branchSectionId === null) {
        return NextResponse.json({ error: 'Invalid branchSectionId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const section = await BranchSectionService.getSection(branchSectionId);
        requireGuideAccess(user, { branchId: section.branchId, visibleToStaff: section.isActive }, BranchSectionNotFoundError, 'edit')
        const upload = await GuideImageService.createUpload(section);
        return NextResponse.json(upload, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to create photo upload');
    }
}
