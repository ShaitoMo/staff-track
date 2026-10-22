import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { BranchSectionService } from '@/services/branch-section-service'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'

/** POST .../reactivate — the section and its folders come back, photos and all. Returns the counts. */
export async function POST(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]/reactivate'>
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
        const result = await BranchSectionService.reactivateSection(branchSectionId);
        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to reactivate section');
    }
}
