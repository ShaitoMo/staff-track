import type { login } from "@/i18n/dictionaries/en/login";
import { ApiError } from "@/lib/api-client";

/** The sign-in form's message for a failed `login()` call. */
export function loginErrorMessage(error: unknown, messages: typeof login): string {
    if (!(error instanceof ApiError)) return messages.cantReachServer;
    // a wrong phone or password is the one refusal everyone sees, so it's worded here in both languages
    return error.status === 401 ? messages.invalidCredentials : error.message;
}
