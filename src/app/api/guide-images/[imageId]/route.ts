import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseJsonBody, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { GuideImageService } from '@/services/guide-image-service'
import { UpdateGuideImageSchema } from '@/types/shelf-guide'
import { GuideImageNotFoundError } from '@/exceptions/guide-image-not-found-error'

export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/guide-images/[imageId]'>
) {
    const imageId = parseNumericId((await ctx.params).imageId);

    if (imageId === null) {
        return NextResponse.json({ error: 'Invalid imageId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        const image = await GuideImageService.getImage(imageId);
        requireGuideAccess(user, image, GuideImageNotFoundError)
        return NextResponse.json(image.view, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to fetch photo');
    }
}

/** PATCH /api/guide-images/:id — `title` (blank clears it) and/or a fresh photoKey + thumbKey pair to replace the files. */
export async function PATCH(
    req: NextRequest,
    ctx: RouteContext<'/api/guide-images/[imageId]'>
) {
    const imageId = parseNumericId((await ctx.params).imageId);

    if (imageId === null) {
        return NextResponse.json({ error: 'Invalid imageId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const parsed = await parseJsonBody(req, UpdateGuideImageSchema);

    if (parsed.error) {
        return parsed.error;
    }

    try {
        const existing = await GuideImageService.getImage(imageId);
        requireGuideAccess(user, existing, GuideImageNotFoundError, 'edit')
        const image = await GuideImageService.updateImage(existing, parsed.data);
        return NextResponse.json(image.view, { status: 200 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to update photo');
    }
}

/** DELETE /api/guide-images/:id — to the recycle bin; the files stay until it is purged. */
export async function DELETE(
    req: NextRequest,
    ctx: RouteContext<'/api/guide-images/[imageId]'>
) {
    const imageId = parseNumericId((await ctx.params).imageId);

    if (imageId === null) {
        return NextResponse.json({ error: 'Invalid imageId' }, { status: 400 });
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    try {
        requireGuideAccess(user, await GuideImageService.getImage(imageId), GuideImageNotFoundError, 'edit')
        await GuideImageService.deleteImage(imageId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return guideErrorResponse(error, 'Failed to delete photo');
    }
}
