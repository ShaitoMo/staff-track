/** Change password: the current password given doesn't match. A 400, not a 401 — the session itself is fine. */
export class IncorrectPasswordError extends Error {
    constructor(message = 'Current password is incorrect') {
        super(message)
        this.name = 'IncorrectPasswordError'
    }
}
