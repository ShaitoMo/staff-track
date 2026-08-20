import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { CreateRegisterSchema } from '@/types/register'
import { getCurrentUser } from '@/lib/auth'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { parseJsonBody } from '@/lib/route-utils'

export async function POST(req: NextRequest) {
    const user = getCurrentUser(req)

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const parsed = await parseJsonBody(req, CreateRegisterSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        requireRole(user, [OWNER_ROLE, MANAGER_ROLE])
        requireBranchAccess(user, parsed.data.branchId)
        const register = await RegisterService.createRegister(parsed.data);
        return NextResponse.json(register, { status: 201 })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof BranchNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to create register' }, { status: 500 })
    }
}
