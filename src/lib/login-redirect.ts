/**
 * Where a sign-in lands: `next` when it's a path on this site, otherwise `/`. A leading `//` or `/\`
 * is refused because a browser reads either as another host, and `/login` because landing back on
 * the form would look like the sign-in failed.
 */
export function nextPath(next: string | null | undefined): string {
    if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
    const pathname = next.split(/[?#]/, 1)[0];
    return pathname === "/login" ? "/" : next;
}

/** The sign-in link that brings the User back to `path` (pathname plus query) afterwards. */
export function loginHref(path: string): string {
    return `/login?next=${encodeURIComponent(path)}`;
}
