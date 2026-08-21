import { NextRequest, NextResponse } from 'next/server'
import { RoleService } from '@/services/role-service'
import { CreateRoleSchema } from '@/types/role'
import { OWNER_ROLE, requireRole } from '@/lib/rbac'
import { DuplicateRoleNameError } from '@/exceptions/duplicate-role-name-error'
import { requireAuthenticated, forbiddenResponse, zodErrorResponse } from '@/lib/route-utils'
import { logger } from '@/lib/logger'

export async function GET() {
    try {
        const roles = await RoleService.getAllRoles();
        return NextResponse.json(roles, { status: 200 });
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch roles');
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
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
        const role = await RoleService.createRole(validationResult.data);
        return NextResponse.json(role, { status: 201 })
    } catch (error) {
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof DuplicateRoleNameError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to create role');
        return NextResponse.json({ error: 'Failed to create role' }, { status: 500 })
    }
}
