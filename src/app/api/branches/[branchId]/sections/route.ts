import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse, queryFlag } from '@/lib/guide-errors'
import { canEditGuide, requireGuideAccess } from '@/lib/rbac'
import { BranchSectionService } from '@/services/branch-section-service'
import { CreateBranchSectionSchema } from '@/types/shelf-guide'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'

/** GET /api/branches/:branchId/sections?includeInactive=true — inactive ones only for owner/manager. */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]/sections'>
) {
    const branchId = parseNumericId((await ctx.params).branchId);

    if (branchId === null) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireGuideAccess(user, { branchId, visibleToStaff: true }, BranchNotFoundError)
        const includeInactive = queryFlag(req.nextUrl, 'includeInactive') && canEditGuide(user)
        const sections = await BranchSectionService.getSectionsByBranch(branchId, includeInactive);
        return NextResponse.json(sections, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to fetch sections');
    }
}

export async function POST(
    req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]/sections'>
) {
    const branchId = parseNumericId((await ctx.params).branchId);

    if (branchId === null) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, CreateBranchSectionSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireGuideAccess(user, { branchId, visibleToStaff: true }, BranchNotFoundError, 'edit')
        const section = await BranchSectionService.createSection(branchId, parsed.data);
        return NextResponse.json(section, { status: 201 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to create section');
    }
}
