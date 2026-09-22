import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, forbiddenResponse } from '@/lib/route-utils'
import { TaskInstanceService } from '@/services/task-instance-service'
import { InvalidPhotoError } from '@/lib/storage'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { PhotoRequiredError } from '@/exceptions/photo-required-error'
import { InactiveTaskError } from '@/exceptions/inactive-task-error'

/** PATCH .../complete — multipart `photo` only; completer and completed_at both come from the session/server clock, not the body. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/complete'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    let formData: FormData
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json(
            { error: 'Expected a multipart/form-data body' },
            { status: 400 },
        )
    }

    const photo = formData.get('photo');

    // a text field named `photo` is not a photo; require an actual upload
    if (!(photo instanceof File)) {
        return NextResponse.json({ error: new PhotoRequiredError().message }, { status: 400 })
    }

    try {
        const instance = await TaskInstanceService.completeInstance({
            instanceId: Number(instanceIdParam),
            completedBy: user.userId,
            photo,
        });

        return NextResponse.json(instance, { status: 200 })
    } catch (error) {
        if (error instanceof TaskInstanceNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        const forbidden = forbiddenResponse(error);
        if (forbidden) {
            return forbidden;
        }
        if (error instanceof InvalidStatusTransitionError || error instanceof InactiveTaskError) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (error instanceof InvalidPhotoError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error(error);
        return NextResponse.json({ error: 'Failed to complete task instance' }, { status: 500 })
    }
}
