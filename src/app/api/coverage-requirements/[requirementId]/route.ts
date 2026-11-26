import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { CoverageRequirementService } from '@/services/coverage-requirement-service'
import { UpdateCoverageRequirementSchema } from '@/types/coverage-requirement'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { CoverageRequirementNotFoundError } from '@/exceptions/coverage-requirement-not-found-error'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

/** PATCH /api/coverage-requirements/:id — requiredCount is the only editable field. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/coverage-requirements/[requirementId]'>
) {
    const { requirementId: requirementIdParam } = await ctx.params;

    if (!/^\d+$/.test(requirementIdParam)) {
        return invalidIdResponse('requirementId');
    }

    const requirementId = Number(requirementIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await CoverageRequirementService.getRequirementById(requirementId);

    if (!existing) {
        return appErrorResponse(new CoverageRequirementNotFoundError(), 404);
    }

    let body
    try {
        body = await req.json();
    } catch {
        return invalidJsonResponse()
    }

    const validationResult = UpdateCoverageRequirementSchema.safeParse(body);

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
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
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to update coverage requirement')
        return internalErrorResponse('Failed to update coverage requirement')
    }
}

/** DELETE /api/coverage-requirements/:id */
export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/coverage-requirements/[requirementId]'>
) {
    const { requirementId: requirementIdParam } = await ctx.params;

    if (!/^\d+$/.test(requirementIdParam)) {
        return invalidIdResponse('requirementId');
    }

    const requirementId = Number(requirementIdParam);

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const existing = await CoverageRequirementService.getRequirementById(requirementId);

    if (!existing) {
        return appErrorResponse(new CoverageRequirementNotFoundError(), 404);
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
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to delete coverage requirement')
        return internalErrorResponse('Failed to delete coverage requirement')
    }
}
