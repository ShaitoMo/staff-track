import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { OWNER_ROLE, requireRole } from '@/lib/rbac'
import { SectionTypeService } from '@/services/section-type-service'
import { UpdateSectionTypeSchema } from '@/types/shelf-guide'
import { invalidIdResponse } from '@/lib/error-response'

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/section-types/[sectionTypeId]'>
) {
    const sectionTypeId = parseNumericId((await ctx.params).sectionTypeId);

    if (sectionTypeId === null) {
        return invalidIdResponse('sectionTypeId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, UpdateSectionTypeSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE])
        const sectionType = await SectionTypeService.updateSectionType(sectionTypeId, parsed.data);
        return NextResponse.json(sectionType, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to update section type');
    }
}

/** DELETE /api/section-types/:id — soft: the type goes inactive; nothing cascades. */
export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/section-types/[sectionTypeId]'>
) {
    const sectionTypeId = parseNumericId((await ctx.params).sectionTypeId);

    if (sectionTypeId === null) {
        return invalidIdResponse('sectionTypeId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireRole(user, [OWNER_ROLE])
        await SectionTypeService.deactivateSectionType(sectionTypeId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to deactivate section type');
    }
}
