import type { LoginInput } from "@/types/auth";
import { ErrorBodySchema, type ErrorBody } from "@/types/api-error";

type ErrorDetails = Partial<Pick<ErrorBody, "code" | "fields" | "current">>;

/**
 * A non-2xx answer from /api/*. `message` is the server's English text; `code`, `fields` and `current`
 * are what the client translates and acts on (ADR 0002). All three are missing for a body in the
 * old shape or one that isn't JSON at all.
 */
export class ApiError extends Error {
    readonly code?: string;
    readonly fields?: ErrorBody["fields"];
    readonly current?: unknown;

    constructor(message: string, readonly status: number, details: ErrorDetails = {}) {
        super(message);
        this.code = details.code;
        this.fields = details.fields;
        this.current = details.current;
    }
}

/** The direct-to-storage photo PUT failed (network, CORS, or the bucket refused it): no server message to show. */
export class PhotoUploadError extends ApiError {
    constructor(status = 0) {
        super("The photo didn't upload. Check your connection and try again.", status, { code: "PHOTO_UPLOAD_FAILED" });
    }
}

/**
 * Throws an ApiError from the response's error body. A body without a `code` still gives its `error`
 * text, and one with neither gives `fallback`.
 */
export async function throwApiError(res: Response, fallback: string): Promise<never> {
    const body: unknown = await res.json().catch(() => null);
    const parsed = ErrorBodySchema.safeParse(body);

    if (parsed.success) {
        const { error, ...details } = parsed.data;
        throw new ApiError(error, res.status, details);
    }

    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : fallback;
    throw new ApiError(message, res.status);
}

/** Fired when a call finds the session gone, so the shell can offer to sign in again (SessionEndedNotice). */
export const SESSION_ENDED_EVENT = "stafftrack:session-ended";

export async function request(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
    const { json, ...rest } = init;
    const res = await fetch(path, {
        ...rest,
        headers: json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
        body: json === undefined ? rest.body : JSON.stringify(json),
    });

    if (!res.ok) {
        try {
            await throwApiError(res, `Request to ${path} failed (${res.status})`);
        } catch (error) {
            if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
                window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
            }
            throw error;
        }
    }
    return res;
}

export async function login(input: LoginInput): Promise<void> {
    await request("/api/auth/login", { method: "POST", json: input });
}

export async function logout(): Promise<void> {
    await request("/api/auth/logout", { method: "POST" });
}
