import { NextRequest, NextResponse } from 'next/server'
import { TaskInstanceService } from '@/services/task-instance-service'
import { CompleteTaskInstanceSchema } from '@/types/task-instance'
import { InvalidPhotoError } from '@/lib/storage'
import { TaskInstanceNotFoundError } from '@/exceptions/task-instance-not-found-error'
import { InvalidStatusTransitionError } from '@/exceptions/invalid-status-transition-error'
import { ForbiddenError } from '@/exceptions/forbidden-error'
import { PhotoRequiredError } from '@/exceptions/photo-required-error'
import { InactiveTaskError } from '@/exceptions/inactive-task-error'

/**
 * PATCH /api/task-instances/:instanceId/complete
 *
 * multipart/form-data: `photo` (required file) and `completed_by`.
 * No timestamp is read from the request — completed_at comes from the server clock.
 */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/task-instances/[instanceId]/complete'>
) {
    const { instanceId: instanceIdParam } = await ctx.params;

    if (!/^\d+$/.test(instanceIdParam)) {
        return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
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

    const validationResult = CompleteTaskInstanceSchema.safeParse({
        completed_by: formData.get('completed_by') ?? undefined,
    });

    if (!validationResult.success) {
        const errors = validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))
        return NextResponse.json({ error: errors }, { status: 400 })
    }

    const photo = formData.get('photo');

    // a text field named `photo` is not a photo; require an actual upload
    if (!(photo instanceof File)) {
        return NextResponse.json({ error: new PhotoRequiredError().message }, { status: 400 })
    }

    try {
        const instance = await TaskInstanceService.completeInstance({
            instanceId: Number(instanceIdParam),
            completedBy: validationResult.data.completed_by,
            photo,
        });

        return NextResponse.json(instance, { status: 200 })
    } catch (error) {
        if (error instanceof TaskInstanceNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: 403 })
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
