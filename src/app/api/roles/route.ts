import { NextRequest, NextResponse } from 'next/server'
import { RoleService } from '@/services/role-service'
import { CreateRoleSchema } from '@/types/role'
import { OWNER_ROLE, requireRole } from '@/lib/rbac'
import { DuplicateRoleNameError } from '@/exceptions/duplicate-role-name-error'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse, invalidJsonResponse, validationErrorResponse } from '@/lib/error-response'

export async function GET() {
    try {
        const roles = await RoleService.getAllRoles();
        return NextResponse.json(roles, { status: 200 });
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch roles');
        return internalErrorResponse('Failed to fetch roles');
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
        return invalidJsonResponse()
    }

    const validationResult = CreateRoleSchema.safeParse(body);

    if (!validationResult.success) {
        return validationErrorResponse(validationResult.error, body)
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
            return appErrorResponse(error, 409)
        }
        logger.error({ err: error }, 'Failed to create role')
        return internalErrorResponse('Failed to create role')
    }
}
