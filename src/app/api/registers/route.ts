import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { CreateRegisterSchema } from '@/types/register'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'

export async function POST(req: NextRequest) {
    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { branchId, name } = body;

    const validationResult = CreateRegisterSchema.safeParse({ branchId, name });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const register = await RegisterService.createRegister(validationResult.data);
        return NextResponse.json(register, { status: 201 })
    } catch (error) {
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to create register' }, { status: 500 })
    }
}
