import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { CoverageRequirementService } from '@/services/coverage-requirement-service'
import { UpdateCoverageRequirementSchema } from '@/types/coverage-requirement'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { CoverageRequirementNotFoundError } from '@/exceptions/coverage-requirement-not-found-error'

/** PATCH /api/coverage-requirements/:id — requiredCount is the only editable field. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/coverage-requirements/[requirementId]'>
) {
    const { requirementId: requirementIdParam } = await ctx.params;

    if (!/^\d+$/.test(requirementIdParam)) {
        return NextResponse.json({ error: 'Invalid requirementId' }, { status: 400 });
    }

    const requirementId = Number(requirementIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await CoverageRequirementService.getRequirementById(requirementId);

    if (!existing) {
        return NextResponse.json({ error: 'Coverage requirement not found' }, { status: 404 });
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = UpdateCoverageRequirementSchema.safeParse(body);

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, existing.branchId)
        const requirement = await CoverageRequirementService.updateRequirement(requirementId, validationResult.data);
        return NextResponse.json(requirement, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof CoverageRequirementNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update coverage requirement' }, { status: 500 })
    }
}

/** DELETE /api/coverage-requirements/:id */
export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/coverage-requirements/[requirementId]'>
) {
    const { requirementId: requirementIdParam } = await ctx.params;

    if (!/^\d+$/.test(requirementIdParam)) {
        return NextResponse.json({ error: 'Invalid requirementId' }, { status: 400 });
    }

    const requirementId = Number(requirementIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await CoverageRequirementService.getRequirementById(requirementId);

    if (!existing) {
        return NextResponse.json({ error: 'Coverage requirement not found' }, { status: 404 });
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, existing.branchId)
        await CoverageRequirementService.deleteRequirement(requirementId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof CoverageRequirementNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete coverage requirement' }, { status: 500 })
    }
}
