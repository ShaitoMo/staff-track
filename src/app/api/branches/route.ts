import { NextRequest, NextResponse } from 'next/server'
import { BranchService } from '@/services/branch-service'
import { CreateBranchSchema } from '@/types/branch'

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
        const branch = await BranchService.createBranch(validationResult.data);
        return NextResponse.json(branch, { status: 201 })
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 })
    }
}