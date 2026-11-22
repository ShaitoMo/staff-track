# A password change signs out every other session

Sessions are stateless JWTs: a 10-minute access token plus a 7-day refresh token, with no server-side session store. Left alone, a Reset password or Change password would leave every existing session alive for up to 7 days, which defeats the point of a reset after a lost phone or a leaked password. We record when each User last changed their password, and refresh refuses a refresh token issued before that moment. Refresh already reads the User from the database (for current role, branches and active state), so the check costs one column and no extra query. The device that made a Change password gets fresh cookies in the same response, so it stays signed in.

## Considered Options

- **Accept up to 7 days of stale sessions.** No schema change, but a reset wouldn't lock anyone out, which is the reason to reset.
- **A refresh-token table (store and revoke each token).** It allows per-device sign-out, but adds a table, a write on every login and a lookup on every refresh, for a feature nobody has asked for.

## Consequences

- An already-open page keeps working until its access token expires (up to 10 minutes), the same tradeoff as a role or branch change.
- Signing out "everywhere" is only possible through a password change; there is no separate button for it.
