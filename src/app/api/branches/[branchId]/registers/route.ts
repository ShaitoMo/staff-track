import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/branches/[branchId]/registers'>
) {
    const { branchId: branchIdParam } = await ctx.params;

    if (!/^\d+$/.test(branchIdParam)) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 });
    }

    const branchId = Number(branchIdParam);

    try {
        const registers = await RegisterService.getRegistersByBranch(branchId);
        return NextResponse.json(registers, { status: 200 });
    } catch (error) {
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch registers' }, { status: 500 });
    }
}
