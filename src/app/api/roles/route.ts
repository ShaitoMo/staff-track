import { NextRequest, NextResponse } from 'next/server'
import { RoleService } from '@/services/role-service'
import { CreateRoleSchema } from '@/types/role'
import { getCurrentUser } from '@/lib/auth'
import { OWNER_ROLE, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { DuplicateRoleNameError } from '@/exceptions/duplicate-role-name-error'
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
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { name } = body;

    const validationResult = CreateRoleSchema.safeParse({ name });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        requireRole(user, [OWNER_ROLE])
        const role = await RoleService.createRole(validationResult.data);
        return NextResponse.json(role, { status: 201 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof DuplicateRoleNameError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        logger.error({ err: error }, 'Failed to create role');
        return NextResponse.json({ error: 'Failed to create role' }, { status: 500 })
    }
}