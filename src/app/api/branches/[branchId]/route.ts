import { NextRequest, NextResponse } from 'next/server'
import { BranchService } from '@/services/branch-service'
import { CreateBranchSchema } from '@/types/branch'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]'>
) {
    const { branchId: branchIdParam } = await ctx.params;

    if (!/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const branchId = Number(branchIdParam);

    const branch = await BranchService.getBranchById(branchId);

    if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json(branch, { status: 200 });
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]'>
) {
    const { branchId: branchIdParam } = await ctx.params;

    if (!/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const branchId = Number(branchIdParam);

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { name, location } = body;

    const validationResult = CreateBranchSchema.safeParse({ name, location });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const branch = await BranchService.updateBranch(branchId, validationResult.data);
        return NextResponse.json(branch, { status: 200 });
    } catch (error) {
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 })
    }
}
