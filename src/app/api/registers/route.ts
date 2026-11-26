import { NextRequest, NextResponse } from 'next/server'
import { RegisterService } from '@/services/register-service'
import { CreateRegisterSchema } from '@/types/register'
import { MANAGER_ROLE, OWNER_ROLE, requireBranchAccess, requireRole } from '@/lib/rbac'
import { BranchNotFoundError } from '@/exceptions/branch-not-found-error'
import { requireAuthenticated, forbiddenResponse, parseJsonBody } from '@/lib/route-utils'
import { logger } from '@/lib/logger'
import { appErrorResponse, internalErrorResponse } from '@/lib/error-response'

export async function POST(req: NextRequest) {
    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
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
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof BranchNotFoundError) {
            return appErrorResponse(error, 400)
        }
        logger.error({ err: error }, 'Failed to create register')
        return internalErrorResponse('Failed to create register')
    }
}
