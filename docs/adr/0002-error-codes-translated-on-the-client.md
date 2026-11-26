# Error responses carry a code; the client translates it

The UI is Arabic-first, but every API error was English free text, and 400s came in two shapes (a string from `parseJsonBody`, an array from `zodErrorResponse`). Every error body is now `{ error, code, fields? }`: `code` is a stable SCREAMING_SNAKE key that the client looks up in the dictionaries, `fields` is `[{ path, code }]` for field-level problems, and `error` stays as English text that is shown only when the client has no translation for the code. Field codes are a small generic set mapped from Zod issue kinds (`REQUIRED`, `TOO_LONG`, `TOO_SHORT`, `INVALID_FORMAT`, `OUT_OF_RANGE`, `INVALID`), plus named codes for custom rules such as `ASSIGNEE_XOR_ROLE`. Only one 409 also carries the record's current state: `INSTANCE_ALREADY_COMPLETED`, with `current: { status, completed_by_name, completed_at }`, so the row can update in place.

## Considered Options

- **Translate on the server from the `locale` cookie.** Keeps the client simple, but puts a second copy of the dictionaries behind the API and ties every response to the caller's UI language.
- **A field map (`{ phone: "TAKEN" }`) instead of an array.** It can't hold two problems on one field or problems on nested paths without a second convention.
- **A specific code for every field and rule.** Precise, but the catalogue grows with every schema, while the generic set covers almost every message a form shows.

## Consequences

- A new error is two edits: a `code` at the throw site and its text in `en` and `ar` (`ar` is typed against `en`, so a missing translation fails `tsc`).
- `throwApiError` keeps reading the `error` string, so callers that haven't moved to `code` keep working during the migration.
