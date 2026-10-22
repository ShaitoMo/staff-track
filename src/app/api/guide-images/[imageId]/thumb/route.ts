import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuidePhotoAccess } from '@/lib/guide-photo-access'
import { getPhotoViewUrl } from '@/lib/storage'
import { GuideImageService } from '@/services/guide-image-service'

/**
 * GET /api/guide-images/:id/thumb — The thumbnail. Same access as the photo (a manager can still open one in
 * an inactive section or folder; so can staff, through `?instance=` of a task that references it — see
 * requireGuidePhotoAccess); once that passes, redirects to a short-lived signed URL on the private bucket.
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/guide-images/[imageId]/thumb'>
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
        await requireGuidePhotoAccess(user, image, req.nextUrl.searchParams.get('instance'))

        const res = NextResponse.redirect(await getPhotoViewUrl(image.thumbKey), 302);
        // the signed URL is per-request: never cache the redirect, so a revoked user re-runs the access check
        res.headers.set('Cache-Control', 'no-store');
        return res;
    } catch (error) {
        return guideErrorResponse(error, 'Failed to serve photo');
    }
}
