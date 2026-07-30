import { NextRequest, NextResponse } from 'next/server'
import { UserValidateSchema } from '@/types/user'
import { UserService } from '@/services/user-services'
import { DuplicatePhoneError } from '@/exceptions/duplicate-phone-error'

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { name, phone, password, roleId } = body;

    const validationResult = UserValidateSchema.safeParse({ name, phone, password, roleId });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    try {
        const user = await UserService.createUser(validationResult.data);
        return NextResponse.json(user, { status: 201 })
    } catch (error) {
        if (error instanceof DuplicatePhoneError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Invalid roleId' }, { status: 400 })
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
