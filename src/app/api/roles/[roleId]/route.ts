import { NextRequest, NextResponse } from 'next/server'
import { RoleService } from '@/services/role-service'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/roles/[roleId]'>
) {
    const { roleId: roleIdParam } = await ctx.params;

    if (!/^\d+$/.test(roleIdParam)) {
        return NextResponse.json({ error: 'Invalid roleId' }, { status: 400 });
    }

    const roleId = Number(roleIdParam);

    const role = await RoleService.getRoleById(roleId);

    if (!role) {
        return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    return NextResponse.json(role, { status: 200 });
}
