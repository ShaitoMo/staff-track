import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticated, parseNumericId } from '@/lib/route-utils'
import { guideErrorResponse } from '@/lib/guide-errors'
import { requireGuidePhotoAccess } from '@/lib/guide-photo-access'
import { openedAsPage, photoUnavailableRedirect } from '@/lib/photo-unavailable'
import { getPhotoViewUrl, photoExists } from '@/lib/storage'
import { GuideImageService } from '@/services/guide-image-service'
import { invalidIdResponse } from '@/lib/error-response'

/**
 * GET /api/guide-images/:id/file — The full photo. Same access as the photo (a manager can still open one in
 * an inactive section or folder; so can staff, through `?instance=` of a task that references it — see
 * requireGuidePhotoAccess); once that passes, redirects to a short-lived signed URL on the private bucket.
 *
 * A task's reference opens this in a new tab: there, a refused or missing photo goes to /photo-unavailable
 * instead of JSON (see GET /api/media/:id/file, which does the same).
 */
export async function GET(
    req: NextRequest,
    ctx: RouteContext<'/api/guide-images/[imageId]/file'>
) {
    const imageId = parseNumericId((await ctx.params).imageId);

    if (imageId === null) {
        return invalidIdResponse('imageId');
    }

    const user = requireAuthenticated(req);

    if (user instanceof NextResponse) {
        return user;
    }

    const asPage = openedAsPage(req);

    try {
        const image = await GuideImageService.getImage(imageId);
        await requireGuidePhotoAccess(user, image, req.nextUrl.searchParams.get('instance'))

        if (asPage && !(await photoExists(image.storageKey))) {
            return photoUnavailableRedirect(req);
        }

        const res = NextResponse.redirect(await getPhotoViewUrl(image.storageKey), 302);
        // the signed URL is per-request: never cache the redirect, so a revoked user re-runs the access check
        res.headers.set('Cache-Control', 'no-store');
        return res;
    } catch (error) {
        const res = guideErrorResponse(error, 'Failed to serve photo');
        return asPage && (res.status === 403 || res.status === 404) ? photoUnavailableRedirect(req) : res;
    }
}
