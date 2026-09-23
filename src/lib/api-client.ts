import type { LoginInput } from "@/types/auth";

export class ApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

/** Throws an ApiError carrying the response's `error` message, or `fallback` when the body has none. */
export async function throwApiError(res: Response, fallback: string): Promise<never> {
    const body: unknown = await res.json().catch(() => null);
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : fallback;
    throw new ApiError(message, res.status);
}

async function request(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
    const { json, ...rest } = init;
    const res = await fetch(path, {
        ...rest,
        headers: json === undefined ? rest.headers : { "Content-Type": "application/json", ...rest.headers },
        body: json === undefined ? rest.body : JSON.stringify(json),
    });

    if (!res.ok) {
        await throwApiError(res, res.statusText);
    }
    return res;
}

export async function login(input: LoginInput): Promise<void> {
    await request("/api/auth/login", { method: "POST", json: input });
}

export async function logout(): Promise<void> {
    await request("/api/auth/logout", { method: "POST" });
}
