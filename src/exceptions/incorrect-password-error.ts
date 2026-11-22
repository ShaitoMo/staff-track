/** The API's text for this case; the Change password dialog matches it to show its own translated field error. */
export const INCORRECT_PASSWORD_MESSAGE = 'Current password is incorrect'

/** Change password: the current password given doesn't match. A 400, not a 401 — the session itself is fine. */
export class IncorrectPasswordError extends Error {
    constructor(message = INCORRECT_PASSWORD_MESSAGE) {
        super(message)
        this.name = 'IncorrectPasswordError'
    }
}
