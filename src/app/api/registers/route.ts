import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { CreateRegisterSchema } from '@/types/register'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { parseJsonBody } from '@/lib/route-utils'

export async function POST(req: NextRequest) {
    const parsed = await parseJsonBody(req, CreateRegisterSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const register = await RegisterService.createRegister(parsed.data);
        return NextResponse.json(register, { status: 201 })
    } catch (error) {
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to create register' }, { status: 500 })
    }
}
