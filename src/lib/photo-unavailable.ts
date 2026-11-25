import { NextRequest, NextResponse } from 'next/server'

/**
 * Whether the browser is loading a photo route as a page (the photo link opened in a new tab)
 * rather than as an <img>. Sec-Fetch-Dest is exact but only sent to secure origins (HTTPS,
 * localhost), so Accept covers plain HTTP; an <img> load never asks for text/html.
 */
export function openedAsPage(req: NextRequest): boolean {
    return req.headers.get('sec-fetch-dest') === 'document' || (req.headers.get('accept') ?? '').includes('text/html')
}

/** Sends a page load of a refused or missing photo to the translated page, not raw JSON or R2's XML 404. */
export function photoUnavailableRedirect(req: NextRequest): NextResponse {
    return NextResponse.redirect(new URL('/photo-unavailable', req.url))
}
