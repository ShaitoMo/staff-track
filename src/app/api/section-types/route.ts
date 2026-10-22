import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody } from '@/lib/route-utils'
import { guideErrorResponse, queryFlag } from '@/lib/guide-errors'
import { OWNER_ROLE, requireRole } from '@/lib/rbac'
import { SectionTypeService } from '@/services/section-type-service'
import { CreateSectionTypeSchema } from '@/types/shelf-guide'

/** GET /api/section-types?includeInactive=true — the owner's catalogue; any signed-in user may read it. */
export async function GET(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const sectionTypes = await SectionTypeService.getSectionTypes(queryFlag(req.nextUrl, 'includeInactive'));
        return NextResponse.json(sectionTypes, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to fetch section types');
    }
}

export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, CreateSectionTypeSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE])
        const sectionType = await SectionTypeService.createSectionType(parsed.data);
        return NextResponse.json(sectionType, { status: 201 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to create section type');
    }
}
