import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuideAccess } from '@/lib/rbac'
import { getPhotoViewUrl } from '@/lib/storage'
import { GuideImageService } from '@/services/guide-image-service'
import { GuideImageNotFoundError } from '@/exceptions/guide-image-not-found-error'

/**
 * GET /api/guide-images/:id/file — The full photo. Same access as the photo (a manager can still open a
 * recycled one); once that passes, redirects to a short-lived signed URL on the private bucket.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/guide-images/[imageId]/file'>
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

        if (image.filesPurged) {
            throw new GuideImageNotFoundError();
        }

        const res = NextResponse.redirect(await getPhotoViewUrl(image.storageKey), 302);
        // the signed URL is per-request: never cache the redirect, so a revoked user re-runs the access check
        res.headers.set('Cache-Control', 'no-store');
        return res;
    } catch (error) {
        return guideErrorResponse(error, 'Failed to serve photo');
    }
}
