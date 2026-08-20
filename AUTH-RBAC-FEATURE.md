# Auth & RBAC — What Was Built and Why

## 1. The mental model

Two separate concerns, built in that order because the second is meaningless without the first:

| | Auth | RBAC |
| --- | --- | --- |
| Answers | "Who is making this request?" | "Is that person allowed to do this?" |
| Built from | Login, JWTs, cookies, `src/proxy.ts` | `src/lib/rbac.ts`, applied per route |
| Failure mode | 401 Not authenticated | 403 Forbidden / role or branch mismatch |

Before this work, every route was open — no login existed, and the API trusted whatever id a
client claimed to be in `assigned_by`, `completed_by`, `reviewed_by`, `imported_by`. That is a
real problem for a system whose whole point is a photographed, signed-off record of who did what.

---

## 2. Auth: login, tokens, and the proxy gate

### 2.1 Two tokens, not one

A single long-lived JWT would mean a promotion, demotion, or deactivation doesn't take effect
until that token expires — up to days later. The fix is splitting identity from permissions:

| | Refresh token | Access token |
| --- | --- | --- |
| Lifetime | 7 days | 15 minutes |
| Carries | `userId` only | `userId`, `role`, `branchIds` |
| Cookie | `stafftrack_refresh`, httpOnly | `stafftrack_access`, httpOnly |
| Re-checked against DB | On every `/api/auth/refresh` call | Never (that's the point) |

`POST /api/auth/refresh` is the request that actually enforces a role/branch change: it re-reads
the user's *current* `isActive`/role/`branchIds` from the database and mints a fresh access token
from that — not from whatever the refresh token itself says (which is deliberately just an id).
Deactivating a user mid-session means their next refresh attempt fails outright; their old access
token still works, but only until it expires on its own, at most 15 minutes later.

Both tokens are signed with **separate secrets** (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`), so
a leaked access token can't be replayed as a refresh token to mint itself new access forever.

### 2.2 `src/proxy.ts` — one gate, not one check per route

This project is on Next.js 16, where `middleware.ts` is deprecated in favor of `proxy.ts`
(functionally the same file convention, renamed) — and as of v16, Proxy defaults to the **Node.js
runtime**, not Edge. That matters here because it means the same `jose`-based JWT verification
used everywhere else in the app just works in the proxy file, no Edge-runtime workaround needed.

`proxy.ts` runs before every `/api/*` request except the three that must stay reachable without a
session — `login`, `refresh`, `logout`. It verifies the access-token cookie once and, on success,
stamps the caller's identity onto trusted request headers (`x-auth-user-id`, `x-auth-role`,
`x-auth-branch-ids`) before forwarding to the route. Route handlers then read that identity via
`getCurrentUser(req)` in `src/lib/auth.ts` — a plain header read, no repeated JWT verification, no
per-route database hit.

**The one bug worth knowing about, because it was subtle:** header-stripping is unconditional,
done *before* the public-path check rather than folded into it. Early on, the public paths were
let through untouched, headers and all. That was harmless at the time (`login`/`refresh`/`logout`
didn't read identity), but it meant a client could send forged `x-auth-*` headers to a public path
and have them survive to a route handler — invisible today, live the moment anyone adds identity
awareness to a "public" route later. Fixed by always stripping first, then deciding whether a
session is required.

### 2.3 What a login actually is

`POST /api/auth/login` — phone + password, checked with `bcrypt.compare` against the stored hash.
Wrong phone, wrong password, and a deactivated account all return the exact same
`401 Invalid phone or password` — telling them apart would let a caller enumerate which phone
numbers have accounts, or which are currently disabled.

---

## 3. RBAC: who can do what

### 3.1 Three tiers

FR10 calls for "owner sees all branches, a branch manager sees only their own, staff see only
their own data." Only `manager`/`cashier`/`stocker` existed as seeded roles before this work —
**`owner` didn't exist anywhere**, so it was added as a fourth `Role` row (`src/prisma/seed.ts`).
No schema change was needed: `Role.name` was already a free string, not a fixed enum.

| Role | Branch scope | Checked by |
| --- | --- | --- |
| `owner` | Every branch, unconditionally | `role === 'owner'` short-circuits every branch check |
| `manager` | Only branches in their own `branchIds` (from `user_branches`) | `requireBranchAccess` |
| everyone else ("staff") | Only their own data | `requireSelfOrRole` forces the query back to themselves rather than 403ing |

### 3.2 `src/lib/rbac.ts` — three small functions, reused everywhere

```
requireRole(user, [roles])            throws unless user.role is one of these
requireBranchAccess(user, branchId)   throws unless user may act on this branch (owner bypasses)
requireSelfOrRole(user, id, [roles])  throws unless it's their own id, or their role is elevated
```

Every gated route follows the same shape: read `getCurrentUser(req)`, 401 if null, then call one
or more of these inside the route's existing `try`/`catch`, mapping `ForbiddenError` (the base
class all RBAC exceptions extend) to 403. This was applied across ~30 route files: branches,
registers, user-branches, shifts, periods, coverage-requirements, attendance, import-batches,
schedule-vs-actual, tasks, task-instances, media, users, roles.

**Two shapes of branch check**, depending on what the URL carries:

- **List endpoints** (`GET /api/branches`, `GET /api/shifts`, …): a manager's results are
  post-filtered to `branchIds` rather than gated as all-or-nothing, so "give me the list" still
  works — it just comes back narrower.
- **By-id endpoints whose URL doesn't carry a `branchId`** (a register, a period, a coverage
  requirement, by their own id): the resource is fetched first purely to resolve its branch, *then*
  `requireBranchAccess` runs against that. A few of these needed a small `getById` added to their
  repository/service specifically for this (`RegisterService`, `PeriodService`,
  `CoverageRequirementService`) — they didn't exist before because nothing needed a single-record
  lookup until a route guard did.

### 3.3 Two special cases

- **`roles`**: read is open to anyone authenticated (needed for basic reference data like
  populating a dropdown); write (`POST`/`PATCH`) is owner-only, since a Role affects the whole
  chain, not one branch.
- **`periods` and their coverage requirements**: a period can be branch-specific *or* chain-wide
  (`branchId: null`). A chain-wide period is owner-only to create or edit; a branch's own period
  just needs `requireBranchAccess` like everything else.

### 3.4 Closing the FR9 gap

`TASK-FEATURE.md` and `TO-BE-REVIEWED.md` both flagged, by name, that task review had no role
check — any active user attached to a branch could verify or reject a colleague's work, seeded
example: "Bob (cashier, Main) can review Frank's completion at Main." `assertMayReview` in
`task-instance-service.ts` now requires the reviewer to actually be `owner` (any branch) or
`manager` (their own branch), reusing `UserRepository.getAuthContext` — a single query that
already existed for the refresh flow, so no new query was needed to close this.

---

## 4. Closing the spoofing gap: acting user comes from the session

RBAC alone only answers "can this session hit this endpoint" — it says nothing about whether the
body's claimed identity is the truth. Before this pass, `completed_by`, `reviewed_by`,
`assigned_by`, and `imported_by` were all still self-reported request fields, meaning a logged-in
session for user A could complete a task, review a task, or import attendance *as user B* just by
naming them in the JSON body.

Fixed by dropping all four from their Zod schemas and merging the session's `userId` in at the
route, after validation:

```ts
// before: const task = await TaskService.createTask(validationResult.data)
const task = await TaskService.createTask({ ...validationResult.data, assigned_by: user.userId })
```

A Zod object schema silently strips unrecognized keys by default, so a client that still sends the
old field name has it quietly ignored — no error, no effect. This also makes the FR9 fix from §3.4
airtight: it was previously possible to check "is the *named* reviewer a manager" while the actual
caller was someone else entirely; now the named reviewer *is* the caller, always.

**Verified live**, three separate spoof attempts, all ignored:

| Who | Claimed in body | Actually recorded |
| --- | --- | --- |
| Bob (cashier) completing his own task | `completed_by: 95` (a manager) | `completed_by: 97` (Bob, his real session) |
| Alice (manager) reviewing it | `reviewed_by: 99` (a nonexistent user) | `reviewed_by: 95` (Alice) |
| Alice creating a task | `assigned_by: 94` (the owner) | `assigned_by: 95` (Alice) |

---

## 5. Files

### New

| File | What it does |
| --- | --- |
| `src/lib/auth.ts` | Sign/verify for both token types, cookie configs, `getCurrentUser` (header-based) |
| `src/lib/rbac.ts` | `requireRole`, `requireBranchAccess`, `requireSelfOrRole`, the `OWNER_ROLE`/`MANAGER_ROLE` constants |
| `src/proxy.ts` | The one authentication gate for `/api/*` |
| `src/services/auth-service.ts` | `login`, `refresh` |
| `src/types/auth.ts` | `LoginSchema`, `RefreshTokenPayload`, `AccessTokenPayload` |
| `src/exceptions/invalid-credentials-error.ts`, `invalid-refresh-token-error.ts` | 401s |
| `src/exceptions/insufficient-role-error.ts`, `branch-access-denied-error.ts` | 403s, both extend the existing `ForbiddenError` |
| `src/app/api/auth/{login,logout,refresh,me}/route.ts` | The four auth endpoints |

### Modified

| File | Change |
| --- | --- |
| `src/prisma/seed.ts` | Added the `owner` role and a seeded owner user (no branch links) |
| `src/repository/user-repository.ts` | `getUserByPhoneForAuth` (login), `getAuthContext` (refresh + review-role check) |
| `src/services/task-instance-service.ts` | `assertMayReview` now checks role, not just branch/active |
| `~30 route files` | Auth check + RBAC gate added to every handler; see §3.2 |
| `src/types/task.ts`, `task-instance.ts`, `attendance-import.ts` | `assigned_by`/`completed_by`/`reviewed_by`/`imported_by` removed from client-facing schemas |
| `.env` | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (gitignored) |

---

## 6. Testing it

```bash
# 1. Log in — sets both cookies
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"555-0100","password":"<their real password>"}'

# 2. Who am I?
curl -b cookies.txt http://localhost:3000/api/auth/me
# -> { "userId": ..., "role": "manager", "branchIds": [21] }

# 3. Try something without a session
curl http://localhost:3000/api/branches
# -> 401 { "error": "Not authenticated" }

# 4. With a session, scoped to the caller's own branches
curl -b cookies.txt http://localhost:3000/api/branches

# 5. Refresh — mints a new 15-minute access token
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/refresh

# 6. Log out — clears both cookies, works even with an expired one
curl -b cookies.txt -X POST http://localhost:3000/api/auth/logout
```

Seeded users all carry a placeholder (non-bcrypt) password hash, so none can log in out of the
box — set a real one first (`PUT /api/users/:id/password`, or directly via Prisma in dev) before
testing login end to end.

---

## 7. Known gaps — deliberate, not oversights

1. **Fine-grained branch enforcement stops at the RBAC pass described here.** It was built and
   verified against the routes listed in §3.2; any *new* branch-scoped route added later needs the
   same treatment by hand — there's no framework-level enforcement that a forgotten route fails
   closed.
2. **`getCurrentUser` trusts the access token for up to 15 minutes.** A role change, branch
   reassignment, or deactivation is only guaranteed to take effect on that user's *next refresh*,
   not instantly. This is the deliberate tradeoff described in §2.1, not a bug.
3. **No session revocation list.** Tokens are stateless; logout clears the client's cookies but
   cannot invalidate a token already copied elsewhere. A compromised token is valid until it
   expires (15 minutes for access, 7 days for refresh) regardless of logout.
4. **Password reset / "forgot password" doesn't exist.** `PUT /api/users/:id/password` requires
   already being logged in as that user (or an owner/manager) — there's no unauthenticated reset
   flow.
