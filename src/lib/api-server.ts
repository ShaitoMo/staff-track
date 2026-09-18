import { cookies, headers } from "next/headers";
import { ApiError } from "@/lib/api-client";

/** Resolves the current request's own origin, so a Server Component can call its own API routes. */
async function getOrigin(): Promise<string> {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    const protocol = requestHeaders.get("x-forwarded-proto")
        ?? (process.env.NODE_ENV === "production" ? "https" : "http");
    return `${protocol}://${host}`;
}

/** Calls one of this app's own /api/* routes from a Server Component, forwarding the session cookie. */
export async function fetchApi<T>(path: string): Promise<T> {
    const [origin, cookieStore] = await Promise.all([getOrigin(), cookies()]);
    const res = await fetch(`${origin}${path}`, {
        headers: { cookie: cookieStore.toString() },
        cache: "no-store",
    });

    if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = typeof body?.error === "string" ? body.error : `Request to ${path} failed (${res.status})`;
        throw new ApiError(message, res.status);
    }

    return res.json();
}
