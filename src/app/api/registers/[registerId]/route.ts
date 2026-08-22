import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { UpdateRegisterSchema } from '@/types/register'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { logger } from '@/lib/logger'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/registers/[registerId]'>
) {
    const { registerId: registerIdParam } = await ctx.params;

    if (!/^\d+$/.test(registerIdParam)) {
        return NextResponse.json({ error: 'Invalid registerId' }, { status: 400 });
    }

    const registerId = Number(registerIdParam);

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const register = await RegisterService.getRegisterById(registerId);

    if (!register) {
        return NextResponse.json({ error: 'Register not found' }, { status: 404 });
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, register.branchId)
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        throw error
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

    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const existing = await RegisterService.getRegisterById(registerId);

    if (!existing) {
        return NextResponse.json({ error: 'Register not found' }, { status: 404 });
    }

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
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, existing.branchId)
        const register = await RegisterService.updateRegister(registerId, validationResult.data);
        return NextResponse.json(register, { status: 200 });
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof RegisterNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        logger.error({ err: error }, 'Failed to update register');
        return NextResponse.json({ error: 'Failed to update register' }, { status: 500 })
    }
}
