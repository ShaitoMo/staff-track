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

    // TODO: hash with bcrypt before storing — plaintext for now
    const passwordHash = password;

    try {
        const user = await UserService.createUser({ name, phone, passwordHash, roleId });
        return NextResponse.json(user, { status: 201 })
    } catch (error) {
        if (error instanceof DuplicatePhoneError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Invalid roleId' }, { status: 400 })
    }
}
