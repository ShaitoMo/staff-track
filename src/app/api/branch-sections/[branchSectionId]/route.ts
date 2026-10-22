import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { BranchSectionService } from '@/services/branch-section-service'
import { UpdateBranchSectionSchema } from '@/types/shelf-guide'
import { BranchSectionNotFoundError } from '@/exceptions/branch-section-not-found-error'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]'>
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
        requireGuideAccess(user, { branchId: section.branchId, visibleToStaff: section.isActive }, BranchSectionNotFoundError)
        return NextResponse.json(section, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to fetch section');
    }
}

/** PATCH /api/branch-sections/:id — position only; deactivate is DELETE, reactivate is POST .../reactivate. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]'>
) {
    const branchSectionId = parseNumericId((await ctx.params).branchSectionId);

    if (branchSectionId === null) {
        return NextResponse.json({ error: 'Invalid branchSectionId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, UpdateBranchSectionSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const existing = await BranchSectionService.getSection(branchSectionId);
        requireGuideAccess(user, { branchId: existing.branchId, visibleToStaff: existing.isActive }, BranchSectionNotFoundError, 'edit')
        const section = await BranchSectionService.updateSection(branchSectionId, parsed.data);
        return NextResponse.json(section, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to update section');
    }
}

/** DELETE /api/branch-sections/:id — deactivates it: it and its folders go inactive, hiding their photos from staff. */
export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/branch-sections/[branchSectionId]'>
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
        const existing = await BranchSectionService.getSection(branchSectionId);
        requireGuideAccess(user, { branchId: existing.branchId, visibleToStaff: existing.isActive }, BranchSectionNotFoundError, 'edit')
        await BranchSectionService.deactivateSection(branchSectionId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to deactivate section');
    }
}
