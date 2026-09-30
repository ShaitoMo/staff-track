const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

interface AttemptRecord {
    count: number
    lockedUntil: number | null
}

/**
 * In-memory per-phone lockout for the login route. Single-instance only — resets on restart
 * and isn't shared across processes — but stops the simplest credential-stuffing loop, which
 * is all a lean fix needs here.
 */
const attempts = new Map<string, AttemptRecord>()

/** True while `phone` is locked out from further login attempts. */
export function isLoginLocked(phone: string): boolean {
    const record = attempts.get(phone)
    return !!record?.lockedUntil && record.lockedUntil > Date.now()
}

/** Counts a failed attempt, locking `phone` out once MAX_ATTEMPTS is reached. */
export function recordFailedLogin(phone: string): void {
    const record = attempts.get(phone) ?? { count: 0, lockedUntil: null }
    record.count += 1

    if (record.count >= MAX_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOCKOUT_MS
        record.count = 0
    }

    attempts.set(phone, record)
}

/** Clears the failure count for `phone` on a successful login. */
export function clearLoginAttempts(phone: string): void {
    attempts.delete(phone)
}
