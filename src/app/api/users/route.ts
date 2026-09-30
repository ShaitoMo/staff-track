import { NextRequest, NextResponse } from 'next/server'
import { UserValidateSchema } from '@/types/user'
import { UserService } from '@/services/user-service'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'
import { InvalidRoleError } from '@/exceptions/invalid-role-error'
import { zodErrorResponse } from '@/lib/route-utils'

export async function POST(req: NextRequest) {
    let body
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validationResult = UserValidateSchema.safeParse(body);

    if (!validationResult.success) {
        return zodErrorResponse(validationResult.error)
    }

    try {
        const user = await UserService.createUser(validationResult.data);
        return NextResponse.json(user, { status: 201 })
    } catch (error) {
        if (error instanceof DuplicatePhoneError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        if (error instanceof InvalidRoleError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }
}
export async function GET() {
    try {
        const users = await UserService.getAllUsers();
        return NextResponse.json(users, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}
