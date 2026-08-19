import { NextRequest, NextResponse } from 'next/server'
import { CoverageRequirementService } from '@/services/coverage-requirement-service'
import { UpdateCoverageRequirementSchema } from '@/types/coverage-requirement'
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
        const requirement = await CoverageRequirementService.updateRequirement(requirementId, validationResult.data);
        return NextResponse.json(requirement, { status: 200 });
    } catch (error) {
        if (error instanceof CoverageRequirementNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update coverage requirement' }, { status: 500 })
    }
}

/** DELETE /api/coverage-requirements/:id */
export async function DELETE(
    _req: NextRequest,
    ctx: RouteContext<'/api/coverage-requirements/[requirementId]'>
) {
    const { requirementId: requirementIdParam } = await ctx.params;

    if (!/^\d+$/.test(requirementIdParam)) {
        return NextResponse.json({ error: 'Invalid requirementId' }, { status: 400 });
    }

    try {
        await CoverageRequirementService.deleteRequirement(Number(requirementIdParam));
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof CoverageRequirementNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete coverage requirement' }, { status: 500 })
    }
}
