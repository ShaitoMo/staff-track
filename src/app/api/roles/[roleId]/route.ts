import { NextRequest, NextResponse } from 'next/server'
import { RoleService } from '@/services/role-service'
import { CreateRoleSchema } from '@/types/role'
import { DuplicateRoleNameError } from '@/exceptions/duplicate-role-name-error'
import { RoleNotFoundError } from '@/exceptions/role-not-found-error'
import { parseNumericId, zodErrorResponse } from '@/lib/route-utils'

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
        console.error(error);
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
        const role = await RoleService.updateRole(roleId, validationResult.data);
        return NextResponse.json(role, { status: 200 });
    } catch (error) {
        if (error instanceof RoleNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof DuplicateRoleNameError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }
}
