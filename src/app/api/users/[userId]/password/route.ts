import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/user-service'
import { UpdatePasswordSchema } from '@/types/user'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { parseNumericId, zodErrorResponse } from '@/lib/route-utils'

export async function PUT(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/password'>
) {
    const { userId: userIdParam } = await ctx.params;

    const userId = parseNumericId(userIdParam);

    if (userId === null) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = UpdatePasswordSchema.safeParse(body);

    if (!validationResult.success) {
        return zodErrorResponse(validationResult.error)
    }

    try {
        await UserService.updatePassword(userId, validationResult.data.password);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }
}
