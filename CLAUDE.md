# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Design

Before any UI/component work, read DESIGN.md and follow its tokens, type scale, and component conventions.

## Agent skills

### Issue tracker

GitHub Issues (`ShaitoMo/staff-track`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Commands

```bash
# Local database (Postgres only — the app itself runs directly via npm, not in Docker)
docker compose up -d
npx prisma migrate deploy
npx prisma db seed          # wipes and reloads sample data; seeded users get a placeholder
                             # password hash and cannot log in until a real one is set
                             # (e.g. PUT /api/users/:id/password, or write it directly via Prisma)

npm run dev                 # Next.js dev server (Turbopack), http://localhost:3000
npm run build                # production build
npm run start                 # run the production build

npm test                      # full Jest suite (ts-jest, Node env)
npx jest src/lib/task-status.test.ts   # single test file
npx jest -t "some test name"           # by test name

npx tsc --noEmit              # typecheck — see gotcha below
npm run lint                  # ESLint (flat config)

npm run job:top-up            # src/jobs/top-up-instances.ts — recurring task-instance
                               # top-up/prune; idempotent, meant to be cron'd
```

**Typecheck gotcha:** API route handlers use Next's generated `RouteContext<'/path/[param]'>` ambient
type from `.next/types/`. Running `tsc --noEmit` against a fresh checkout (no `.next/` yet) fails with
`Cannot find name 'RouteContext'` on every dynamic route — run `npm run build` or `npm run dev` at least
once first to generate those types.

**Standalone scripts** (outside the Next.js request lifecycle, e.g. one-off scripts or `src/jobs/*`) must
`import "dotenv/config"` before importing anything that touches `src/lib/db.ts`, or `DATABASE_URL` is
undefined and Postgres auth fails with an opaque SASL error.

## Architecture

This is a single Next.js 16 App Router project containing both the backend and the frontend — there is
no separate API project or client app.

**Backend layering (`src/app/api/**/route.ts`):** every route handler follows the same shape — parse/
validate the request with a Zod schema (`src/types/*`) → `getCurrentUser(req)` (`src/lib/auth.ts`) →
an RBAC check from `src/lib/rbac.ts` (`requireRole`, `requireBranchAccess`, `requireSelfOrRole`) →
call into `src/services/*` → `src/repository/*` (all Prisma access lives here) → map thrown
`src/exceptions/*` classes to an HTTP status in the route's own `catch`. **Auth/RBAC checks live in the
route handlers, not the services** — a service has no awareness of the caller, so the invariant is that
**no caller reaches a service without an RBAC check first**. `/api/*` is the default path and the only
one that exists today: Server Components read through it over HTTP and Client Components mutate through
it. A Server Action or Server Component may call a service directly only if it does the same steps a
route does — read identity via `src/lib/session.ts`, run the `src/lib/rbac.ts` check, then call the
service — and never a bare service import. Do this deliberately, not incidentally: an unchecked service
call is a permission bypass.

**Auth (`src/proxy.ts`, `src/lib/auth.ts`, `src/lib/session.ts`):** `src/proxy.ts` (Next 16's renamed
`middleware.ts`, Node runtime) is the single gate for every request — API and page routes alike. It
verifies the `stafftrack_access` JWT cookie (`jose`), and on success stamps trusted `x-auth-user-id` /
`x-auth-role` / `x-auth-branch-ids` headers onto the forwarded request; on failure it returns a JSON 401
for `/api/*` or redirects a page request to `/login`. Route handlers read identity via `getCurrentUser`;
Server Components read the same stamped headers via `src/lib/session.ts` (`next/headers`) with no extra
network round-trip. Access tokens are short-lived (15 min) and carry `role`/`branchIds`; only
`POST /api/auth/refresh` re-derives those from the database, so a permission change can take up to 15
minutes to apply to an already-issued token — this is a documented tradeoff, not a bug.

**Frontend (`src/app/(auth)`, `src/app/(app)`, `src/components/ui`):** route groups split public pages
(`(auth)/login`) from session-gated ones (`(app)/*`, whose layout re-checks the session as defense in
depth even though `src/proxy.ts` already redirects unauthenticated page requests). UI components come
from shadcn/ui (`components.json`, `src/components/ui/*`); visual tokens, type scale, and component
conventions are recorded in `DESIGN.md` (`.impeccable/design.json` is its machine-readable sidecar) —
read it before touching any UI.

**Calling the API from the UI:** UI code does not call `fetch` inline; it goes through one of two helpers,
both ending in `/api/*` and both throwing `ApiError` (built by the shared `throwApiError`).
- **Reads in Server Components** use `fetchApi<T>(path)` from `src/lib/api-server.ts`, which builds the
  absolute URL and forwards the session cookie (needs `next/headers`, so server-only). Independent reads
  go in a `Promise.all`.
- **Mutations and interactions in Client Components** use the plain functions in `src/lib/api-client.ts`
  (`login()`, `logout()`, ...). Relative URLs, the browser attaches the cookie. This file must stay free of
  server-only imports.
- Hooks (SWR/TanStack Query) are not used; add them for a screen only if it needs client-side refetching,
  polling, or optimistic updates, wrapping these same functions. Form field state (`useState`) is unrelated.

**Shared contracts (`src/types/*`):** one file per domain, each a Zod schema plus its inferred type.
Wire format is snake_case (`branch_id`, `assigned_to`, ...) everywhere except `user.ts`, which is
camelCase — a known, deliberate-if-unfortunate inconsistency, not something to "fix" incidentally.
