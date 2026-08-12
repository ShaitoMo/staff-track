# To Be Reviewed

Open items deliberately deferred, not forgotten. Each one is a decision that was
made consciously and can be reversed cheaply.

## 1. Duplicated `assertXExists` helpers across services

Four call sites, two distinct helpers:

| Helper | Currently in |
| --- | --- |
| `assertUserExists` | `src/services/user-branch-service.ts`, `src/services/branch-service.ts` |
| `assertBranchExists` | `src/services/user-branch-service.ts`, `src/services/register-service.ts` |

**Target shape:** make each a public `static` on the service that owns the
entity — `UserService.assertUserExists`, `BranchService.assertBranchExists` — and
have the other services import it. The bodies are already correct; they only move
up one layer.

**Why that owner:** the owner of an existence check is the entity being asserted,
not the caller doing the asserting. `UserNotFoundError` is user-domain knowledge,
so it belongs with the user code.

**Tradeoff to accept first:** this introduces service→service calls. Today every
service calls only repositories. The alternative, a shared `src/services/assertions.ts`,
avoids that new edge but creates a module with no clear owner that still has to
import every repository — worse, in my view.

**Trigger:** revisit when a third consumer of either helper appears. At two copies
each, duplication is still cheaper than the abstraction.

## 1a. Reviewer is not checked for being a *manager*

`PATCH /api/task-instances/{id}/review` currently requires the reviewer to be an **active user
attached to the task's branch**, and to not be `completed_by`. The spec also asks for "caller
must be a manager of that branch" — that half is **absent by decision**, pending role-based
permissions.

**Effect today:** any active user at the branch can verify or reject a colleague's work. On the
seed data, Bob (cashier, Main) can review Frank's completion at Main.

**Where it goes:** `TaskInstanceService.assertMayReview` — one lookup of the caller's role,
compared against the `manager` role. The branch check it needs is already there.

**Trigger:** whenever role-based permissions land.

## 1b. Acting user arrives in the request body

`assigned_by` (POST /tasks), `completed_by` (complete) and `reviewed_by` (review) are read from
the request. There is no authentication in the project, so a client states who it is and is
believed — anyone can complete work as anyone.

The permission *rules* are implemented and enforced; only the identity behind them is untrusted.
When auth lands, these three fields come off the payloads and out of the zod schemas, and the
services take the session user instead. The service signatures already accept the id as an
argument, so nothing below the routes changes.

## 1c. `npx tsc` and `next build` cannot type check this repo

`tsconfig.json` sets `"ignoreDeprecations": "6.0"`, which TypeScript 5.9.3 rejects outright
(TS5103). Both `npx tsc --noEmit` and `next build` fail before checking a single file — this
predates the task feature and affects the whole project.

**Fix:** drop the line, or set it to `"5.0"`, or upgrade to TypeScript 6. Until then the feature
has been verified by `npm test`, `npm run lint`, and exercising every endpoint against a live
database rather than by static type checking.

## 1d. Media serving route

Media serving route deferred; blocked on auth, permission = same check as viewing the instance.

(`media.file_path` is a storage reference, not a URL — `uploads/` sits outside `public/` so
nothing serves it today.)

## 2. Response casing on `GET /api/users/{userId}/branches`

The API spec's example response uses `branch_id`; the implementation returns
`branchId`.

Chose camelCase to match every other JSON body in the project — `GET /api/branches`
returns `branchId` from the same `Branch` type, and diverging here would give the
same entity two shapes depending on the endpoint. Note that query *parameters* are
snake_case (`?user_id=1`); that is a separate, already-consistent convention.

**Decide:** fix the spec, or map the keys in `BranchRepository.getBranchesByUser`
if a client is already built against the spec.

## 3. `400` vs `409` for duplicate assignment

`POST /api/user-branches` returns `400` for both `DuplicateUserBranchError` and
`DuplicateMachineEmployeeIdError`.

`409 Conflict` is the more accurate status for "this resource already exists", but
`400` matches the existing precedent — `DuplicatePhoneError` on `POST /api/users`
also returns `400`.

**Decide:** leave as-is for consistency, or move all duplicate-resource errors
(including `DuplicatePhoneError`) to `409` together. Changing only the new ones
would make the inconsistency worse, not better.
