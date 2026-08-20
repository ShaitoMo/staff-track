import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { UpdateRegisterSchema } from '@/types/register'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { parseJsonBody, parseNumericId } from '@/lib/route-utils'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/registers/[registerId]'>
) {
    const { registerId: registerIdParam } = await ctx.params;

    const registerId = parseNumericId(registerIdParam);

    if (registerId === null) {
        return NextResponse.json({ error: 'Invalid registerId' }, { status: 400 });
    }

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    try {
        const register = await RegisterService.getRegisterById(registerId);

        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, register.branchId)

        return NextResponse.json(register, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
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

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const parsed = await parseJsonBody(req, UpdateRegisterSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const existing = await RegisterService.getRegisterById(registerId);

        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, existing.branchId)

        const register = await RegisterService.updateRegister(registerId, parsed.data);
        return NextResponse.json(register, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof RegisterNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update register' }, { status: 500 })
    }
}
