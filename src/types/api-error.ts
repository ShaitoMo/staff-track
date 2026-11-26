import { z } from 'zod';

/** A problem with one request field; `path` is dot-joined (`assigned_to`, `items.0.name`). */
export const FieldErrorSchema = z.object({
    path: z.string(),
    code: z.string(),
});

export type FieldError = z.infer<typeof FieldErrorSchema>;

/**
 * Every non-2xx JSON body from /api/* (ADR 0002). `code` is the stable key the client translates;
 * `error` is English text, shown only when the client has no translation for the code. `current`
 * appears on INSTANCE_ALREADY_COMPLETED only.
 */
export const ErrorBodySchema = z.object({
    error: z.string(),
    code: z.string(),
    fields: z.array(FieldErrorSchema).optional(),
    current: z.unknown().optional(),
});

export type ErrorBody = z.infer<typeof ErrorBodySchema>;
