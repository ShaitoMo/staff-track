import { NextRequest, NextResponse } from 'next/server'
import { RoleService } from '@/services/role-service'
import { CreateRoleSchema } from '@/types/role'
import { OWNER_ROLE, requireRole } from '@/lib/rbac'
import { DuplicateRoleNameError } from '@/exceptions/duplicate-role-name-error'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidIdResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/roles/[roleId]'>
) {
    const { roleId: roleIdParam } = await ctx.params;

    const roleId = parseNumericId(roleIdParam);

    if (roleId === null) {
        return invalidIdResponse('roleId');
    }

    try {
        const role = await RoleService.getRoleById(roleId);

        if (!role) {
            return appErrorResponse(new RoleNotFoundError(), 404);
        }

        return NextResponse.json(role, { status: 200 });
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch role');
        return internalErrorResponse('Failed to fetch role');
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/roles/[roleId]'>
) {
    const { roleId: roleIdParam } = await ctx.params;

    const roleId = parseNumericId(roleIdParam);

    if (roleId === null) {
        return invalidIdResponse('roleId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return invalidJsonResponse()
    }

    const validationResult = CreateRoleSchema.safeParse(body);

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
    }

    try {
        requireRole(user, [OWNER_ROLE])
        const role = await RoleService.updateRole(roleId, validationResult.data);
        return NextResponse.json(role, { status: 200 });
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof RoleNotFoundError) {
            return appErrorResponse(error, 404)
        }
        if (error instanceof DuplicateRoleNameError) {
            return appErrorResponse(error, 409)
        }
        logger.error({ err: error }, 'Failed to update role')
        return internalErrorResponse('Failed to update role')
    }
}
