import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/user-services'
import { UpdatePasswordSchema } from '@/types/user'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'

export async function PUT(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]/password'>
) {
    const { userId: userIdParam } = await ctx.params;

    if (!/^\d+$/.test(userIdParam)) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const userId = Number(userIdParam);

    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { password } = body;

    const validationResult = UpdatePasswordSchema.safeParse({ password });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
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
