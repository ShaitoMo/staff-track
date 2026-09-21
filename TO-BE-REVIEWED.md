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

## 1c. `GET /api/task-instances/{id}` does not apply the cancellation filter

The list query hides pending instances of deactivated tasks (`TaskInstanceRepository.buildWhere`).
Fetching one by id goes through `findUnique` and applies no such filter, so a cancelled instance
is still reachable by anyone holding its id.

**Effect today:** the two read paths disagree about whether cancelled work exists. Completing it
is refused either way, so this is a consistency question rather than a hole.

**Decide:** leave it — a manager following a link to cancelled work arguably *should* see it — or
move the filter into a shared helper both paths use. Worth settling when a UI exists to say which
behaviour it expects.

## 1d. `TaskService.updateTask` is not transactional

It reads the task, writes it, then reconciles the task's instances — three statements. A failure
between the write and the reconcile leaves the task updated with instances the new definition does
not explain.

**Why it is survivable:** the daily job runs the same reconciliation across every task, so the
state repairs itself within a day. That convergence is the design, not a happy accident.

**Fix when it matters:** wrap the update and the instance work in one `db.$transaction`, which
means threading a transaction client through `TaskInstanceRepository` the way `createTask` already
does.

## 1e. A schedule change leaves no audit trail

Narrowing a recurrence rule deletes the pending instances it no longer covers. Nothing records
that they existed, or that a person's expected work changed. Only `pending` rows are ever removed,
so no completed work is lost — but "why did Tuesday disappear from my list?" has no answer in the
data.

**Where it goes:** a `task_schedule_changes` table written by `updateTask`, or reusing whatever
general audit-log mechanism arrives first. Deferred because no one has asked the question yet.

## 1f. Media reads have no ownership or permission check

`GET /api/media/:mediaId` and `GET /api/task-instances/:instanceId/media` return whatever record
or list is asked for — there is no caller identity yet to check it against, so anyone who has or
guesses an id can read it. The eventual route that serves the file itself (see below) is blocked
on the same gap and should get the identical check.

**Where it goes:** the same permission `TaskInstanceService.assertMayComplete`/`assertMayReview`
already compute — a manager of the task's branch, or the person assigned/who completed the
instance. Both media reads already resolve the instance (directly or via `MediaRepository`), so
the branch and assignee are one query away once a caller identity exists.

**Trigger:** whenever auth lands.

(`media.file_path` is a storage reference, not a URL — `uploads/` sits outside `public/` so
nothing serves the file itself today.)

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

## 4. Attendance import matches on the machine number only

`POST /api/attendance/import` resolves each row through
`user_branches.machine_employee_id`. A number nobody at the branch is linked to
becomes a row error naming both the number and the `Name` from the file; the rest
of the file still imports.

Falling back to the `Name` column was considered and **rejected**: the name is free
text typed into the clock machine, `users.name` has no unique constraint, and a
wrong match silently attributes one person's hours to another with nothing
downstream to catch it. Linking a number is a one-time cost per employee.

**Revisit if:** the machine reassigns or resets employee numbers, or whoever
uploads cannot administer user-branch links. The shape would be: number first,
then an exact case-insensitive name match among staff at that branch, an error on
ambiguity, and a `records_matched_by_name` count in the response so the fallback
is never silent.

## 5. FR6 compares schedule to attendance in TypeScript, not in a Postgres view

`schema.prisma` says `scheduled_vs_actual` "is a VIEW; model separately or query
raw". `GET /api/schedule-vs-actual` instead reads shifts and punches through the
existing repositories and pairs them in `src/lib/schedule-vs-actual.ts`.

**Why:** the matching rule is the part that keeps changing — the first draft of it
shipped a false `no_show` for anyone working a split day — and in SQL none of it
would be unit-testable. As a pure function it has 27 cases covering DST, split
days, overnight pairs and forgotten clock-outs. A branch-week is a few hundred
rows on both sides, so the in-memory join costs nothing yet.

**Revisit if:** the report is asked for across all branches over a quarter, or a
dashboard polls it. `ScheduleVsActualRow` is already the view's shape, so the move
is a new repository method behind the same service call.

## 5a. A punch is an interval, and may cover more than one shift

`compareScheduleWithAttendance` matches a punch to a shift by **interval overlap**,
and does not mark a punch as spent once matched.

The rejected alternative — matching on `clock_in` and consuming each punch so no
two shifts could claim it — is worth recording because it looks correct. Given two
shift rows 09:00-17:00 and 17:00-21:00 worked on a single punch (in 08:55, out
21:03), the morning shift consumes the punch and the evening shift reports
`no_show` for a man who was in the building for twelve hours. Consumption existed
to stop back-to-back shifts both reading `on_time` off one arrival; overlap draws
that distinction on its own, and reports the skipped-evening case as `left_early`
with a real number instead. The five-row table in
`src/lib/schedule-vs-actual.test.ts` is the regression suite.

The one shape that still needs a bound is an **open** punch: with no clock-out it
would overlap every later shift forever, so it falls back to arrival containment
inside `EARLY_ARRIVAL_WINDOW_MINUTES`.

## 5b. The report cannot see work that was never scheduled

One row per *scheduled shift*, by definition — so someone who came in on a day
they had no shift does not appear anywhere in it, and neither does a punch at a
branch they were not scheduled at. Only the `no_show` direction of the mismatch is
reported.

The other direction is its own query (punches with no shift around them) and
arguably its own endpoint; folding it into these rows would mean rows with no
`shift_id`, which is what the flag set and the FR6 shape were built to avoid.

## 5c. Lateness policy is a constant

`LATE_GRACE_MINUTES = 5` and `EARLY_ARRIVAL_WINDOW_MINUTES = 120` live in
`src/lib/schedule-vs-actual.ts`. Not a query parameter on purpose: a tunable grace
period lets the report be re-run until the numbers look acceptable. When policy
turns out to differ per branch it becomes a column on `branches`, read by the
service and passed into the comparison — the function already takes everything it
needs as arguments.

## 5d. No stored link between a punch and a shift

The pairing is recomputed on every request; nothing is persisted. That means there
is nowhere for a **human correction** to live — a manager who knows a punch
belongs to the other shift cannot say so, because the answer is derived fresh each
time. The same gap covers payroll: changing the grace period retroactively
reclassifies shifts that were already reviewed.

**The trigger is a person disagreeing with the machine, not data volume.** When it
lands, it is a nullable `attendance.shift_id` resolved on write, with reconcile on
shift create/edit/delete, and `compareScheduleWithAttendance` doubles as the
backfill for existing rows.
