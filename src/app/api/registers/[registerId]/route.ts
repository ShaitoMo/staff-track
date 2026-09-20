import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { UpdateRegisterSchema } from '@/types/register'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { parseJsonBody, parseNumericId } from '@/lib/route-utils'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/registers/[registerId]'>
) {
    const { registerId: registerIdParam } = await ctx.params;

    const registerId = parseNumericId(registerIdParam);

    if (registerId === null) {
        return NextResponse.json({ error: 'Invalid registerId' }, { status: 400 });
    }

    try {
        const register = await RegisterService.getRegisterById(registerId);
        return NextResponse.json(register, { status: 200 });
    } catch (error) {
        if (error instanceof RegisterNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch register' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/registers/[registerId]'>
) {
    const { registerId: registerIdParam } = await ctx.params;

    const registerId = parseNumericId(registerIdParam);

    if (registerId === null) {
        return NextResponse.json({ error: 'Invalid registerId' }, { status: 400 });
    }

    const parsed = await parseJsonBody(req, UpdateRegisterSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const register = await RegisterService.updateRegister(registerId, parsed.data);
        return NextResponse.json(register, { status: 200 });
    } catch (error) {
        if (error instanceof RegisterNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update register' }, { status: 500 })
    }
}
