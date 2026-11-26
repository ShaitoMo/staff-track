import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { UpdateRegisterSchema } from '@/types/register'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { RegisterNotFoundError } from '@/exceptions/register-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse } from '@/lib/error-response'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/registers/[registerId]'>
) {
    const { registerId: registerIdParam } = await ctx.params;

    const registerId = parseNumericId(registerIdParam);

    if (registerId === null) {
        return invalidIdResponse('registerId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const register = await RegisterService.getRegisterById(registerId);

        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, register.branchId)

        return NextResponse.json(register, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof RegisterNotFoundError) {
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to fetch register');
        return internalErrorResponse('Failed to fetch register');
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/registers/[registerId]'>
) {
    const { registerId: registerIdParam } = await ctx.params;

    const registerId = parseNumericId(registerIdParam);

    if (registerId === null) {
        return invalidIdResponse('registerId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
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
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof RegisterNotFoundError) {
            return appErrorResponse(error, 404)
        }
        logger.error({ err: error }, 'Failed to update register')
        return internalErrorResponse('Failed to update register')
    }
}
