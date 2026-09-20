import { NextRequest, NextResponse } from 'next/server'
import { BranchService } from '@/services/branch-service'
import { CreateBranchSchema } from '@/types/branch'
import { parseJsonBody } from '@/lib/route-utils'

export async function GET() {
    try {
        const branches = await BranchService.getAllBranches();
        return NextResponse.json(branches, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const parsed = await parseJsonBody(req, CreateBranchSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const branch = await BranchService.createBranch(parsed.data);
        return NextResponse.json(branch, { status: 201 })
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 })
    }
}
