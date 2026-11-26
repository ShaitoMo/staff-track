/**
 * Base for every error a route maps to a status. `code` is the stable key the client translates
 * (ADR 0002); `field` names the request field the error belongs to, when there is one, so the
 * form can show it under that input.
 */
export abstract class AppError extends Error {
    abstract readonly code: string
    readonly field?: string
}
