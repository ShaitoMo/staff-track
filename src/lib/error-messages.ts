import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api-client";
import { CompletedInstanceStateSchema, type CompletedInstanceState } from "@/types/task-instance";

type ErrorMessages = Dictionary["errors"];

export interface TranslatedError<K extends string> {
    /** For the form's banner; null when every problem is already shown under its field. */
    formMessage: string | null;
    fieldMessages: Partial<Record<K, string>>;
}

/**
 * Turns anything a call to /api/* threw into text in the viewer's language (ADR 0002). `fieldMap`
 * names the fields this form shows, wire path to form key (`{ assigned_to: "assignee" }`): a field
 * error on one of them goes under it, and any other goes to the banner so nothing is lost. Without
 * a `fieldMap` everything goes to the banner, so `formMessage` is always set.
 */
export function translateError(error: unknown, messages: ErrorMessages): { formMessage: string; fieldMessages: object };
export function translateError<K extends string>(
    error: unknown,
    messages: ErrorMessages,
    fieldMap: Partial<Record<string, K>>,
): TranslatedError<K>;
export function translateError<K extends string>(
    error: unknown,
    messages: ErrorMessages,
    fieldMap: Partial<Record<string, K>> = {},
): TranslatedError<K> {
    if (!(error instanceof ApiError)) {
        // fetch rejects with a TypeError when the request never got an answer
        const formMessage = error instanceof TypeError ? messages.cantReachServer : messages.somethingWentWrong;
        return { formMessage, fieldMessages: {} };
    }

    const fieldMessages: Partial<Record<K, string>> = {};
    let unplaced: string | undefined;
    for (const { path, code } of error.fields ?? []) {
        const key = fieldMap[path];
        if (key === undefined) {
            unplaced ??= code;
        } else {
            fieldMessages[key] ??= fieldMessage(code, messages);
        }
    }

    const placedAll = (error.fields?.length ?? 0) > 0 && unplaced === undefined;
    return { formMessage: placedAll ? null : codeMessage(error, unplaced, messages), fieldMessages };
}

/**
 * The top-level text: the code's translation, or the server's own English for a code not translated yet.
 * A failed validation says what the first unplaced rule was when that rule has its own sentence (NO_FIELDS).
 */
function codeMessage(error: ApiError, unplaced: string | undefined, messages: ErrorMessages): string {
    const rule = error.code === "VALIDATION_FAILED" ? lookup(messages.codes, unplaced) : undefined;
    return rule ?? lookup(messages.codes, error.code) ?? error.message;
}

/** A field's text: the short generic phrase, a domain code's sentence, or "Not valid." for an unknown code. */
function fieldMessage(code: string, messages: ErrorMessages): string {
    return lookup(messages.fields, code) ?? lookup(messages.codes, code) ?? messages.fields.INVALID;
}

function lookup(table: Record<string, string>, code: string | undefined): string | undefined {
    return code !== undefined && Object.hasOwn(table, code) ? table[code] : undefined;
}

/** The state a 409 INSTANCE_ALREADY_COMPLETED carries, or null for any other error. */
export function alreadyCompletedState(error: unknown): CompletedInstanceState | null {
    if (!(error instanceof ApiError) || error.code !== "INSTANCE_ALREADY_COMPLETED") return null;
    const parsed = CompletedInstanceStateSchema.safeParse(error.current);
    return parsed.success ? parsed.data : null;
}
