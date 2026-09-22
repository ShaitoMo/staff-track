import { NextRequest, NextResponse } from 'next/server'
import { RoleService } from '@/services/role-service'
import { CreateRoleSchema } from '@/types/role'
import { OWNER_ROLE, requireRole } from '@/lib/rbac'
import { DuplicateRoleNameError } from '@/exceptions/duplicate-role-name-error'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseNumericId, zodErrorResponse } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/roles/[roleId]'>
) {
    const { roleId: roleIdParam } = await ctx.params;

    const roleId = parseNumericId(roleIdParam);

    if (roleId === null) {
        return NextResponse.json({ error: 'Invalid roleId' }, { status: 400 });
    }

    try {
        const role = await RoleService.getRoleById(roleId);

        if (!role) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }

        return NextResponse.json(role, { status: 200 });
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch role');
        return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/roles/[roleId]'>
) {
    const { roleId: roleIdParam } = await ctx.params;

    const roleId = parseNumericId(roleIdParam);

    if (roleId === null) {
        return NextResponse.json({ error: 'Invalid roleId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = CreateRoleSchema.safeParse(body);

    if (!validationResult.success) {
        return zodErrorResponse(validationResult.error)
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
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof DuplicateRoleNameError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to update role')
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }
}
