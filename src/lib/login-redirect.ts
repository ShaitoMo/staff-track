const PROBE_ORIGIN = "http://stafftrack.invalid";

/**
 * Where a sign-in lands: `next` when it's a path on this site, otherwise `/`. It's parsed the way
 * a browser would, so `//host`, `/\host` and the like (another host once resolved) are refused, and
 * so is `/login`, since landing back on the form would look like the sign-in failed.
 */
export function nextPath(next: string | null | undefined): string {
    if (!next?.startsWith("/")) return "/";
    const url = new URL(next, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN || url.pathname.replace(/\/+$/, "") === "/login") return "/";
    return url.pathname + url.search + url.hash;
}

/** The sign-in link that brings the User back to `path` (pathname plus query) afterwards. */
export function loginHref(path: string): string {
    return `/login?next=${encodeURIComponent(path)}`;
}
