import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { BranchSectionService } from '@/services/branch-section-service'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'

/** GET .../deactivation-impact — what deactivation would touch, counted before anything changes. */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]/deactivation-impact'>
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
        const impact = await BranchSectionService.getDeactivationImpact(branchSectionId);
        return NextResponse.json(impact, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to count deactivation impact');
    }
}
