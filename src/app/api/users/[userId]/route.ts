import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/services/user-services'
import { UserUpdateSchema } from '@/types/user'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { UserNotFoundError } from '@/exceptions/user-not-found-error'
import { InvalidRoleError } from '@/exceptions/invalid-role-error'

export async function GET(
    _req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]'>
) {
    const { userId: userIdParam } = await ctx.params;

    if (!/^\d+$/.test(userIdParam)) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const userId = Number(userIdParam);

    const user = await UserService.getUserById(userId);

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user, { status: 200 });
}

export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/users/[userId]'>
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
    const { name, phone, roleId, isActive } = body;

    const validationResult = UserUpdateSchema.safeParse({ name, phone, roleId, isActive });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const user = await UserService.updateUser(userId, validationResult.data);
        return NextResponse.json(user, { status: 200 });
    } catch (error) {
        if (error instanceof UserNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof DuplicatePhoneError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        if (error instanceof InvalidRoleError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }
}
