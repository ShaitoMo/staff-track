import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { UpdateRegisterSchema } from '@/types/register'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/registers/[registerId]'>
) {
    const { registerId: registerIdParam } = await ctx.params;

    if (!/^\d+$/.test(registerIdParam)) {
        return NextResponse.json({ error: 'Invalid registerId' }, { status: 400 });
    }

    const registerId = Number(registerIdParam);

    const register = await RegisterService.getRegisterById(registerId);

    if (!register) {
        return NextResponse.json({ error: 'Register not found' }, { status: 404 });
    }

    return NextResponse.json(register, { status: 200 });
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/registers/[registerId]'>
) {
    const { registerId: registerIdParam } = await ctx.params;

    if (!/^\d+$/.test(registerIdParam)) {
        return NextResponse.json({ error: 'Invalid registerId' }, { status: 400 });
    }

    const registerId = Number(registerIdParam);

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { name } = body;

    const validationResult = UpdateRegisterSchema.safeParse({ name });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const register = await RegisterService.updateRegister(registerId, validationResult.data);
        return NextResponse.json(register, { status: 200 });
    } catch (error) {
        if (error instanceof RegisterNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update register' }, { status: 500 })
    }
}
