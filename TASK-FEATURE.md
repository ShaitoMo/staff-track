# Task Feature — What Was Built & How To Test It

Everything in this document is implemented and was verified against a live database.

---

## 1. The mental model

Two tables, and the difference between them is the whole feature:

| | `tasks` | `task_instances` |
| --- | --- | --- |
| What it is | the **definition** — "restock shelves, every Mon & Wed" | one **occurrence** — "restock shelves, on 2026-08-17" |
| Who sees it | managers, when creating work | **workers** |
| Carries | title, branch, assignment, recurrence rule | due date, status, who completed it, who reviewed it, photos |

**Workers only ever see instances.** A task with no instances is invisible to everyone. That is
why `POST /tasks` creates the task *and* its instances in one transaction — a task whose instance
insert failed would be a task nobody can do.

That one sentence drives most of the design decisions below. Anything that would leave a task
without instances, or leave instances a task no longer explains, is either refused or reconciled.

---

## 2. The lifecycle

### 2.1 The path a task takes

```
  POST /tasks
      |
      |  task + instances in one transaction
      |    one-off   -> 1 instance, on due_date
      |    recurring -> every date the rule lands on in [today, today+14]
      v
  [ instances exist ]  <----------------------------.
      |                                             |
      |  GET /task-instances                        |  npm run job:top-up (daily)
      |    the worker's list                        |    insert: re-fill [today, today+14]
      v                                             |    prune:  drop pending rows the rule,
  PATCH /task-instances/:id/complete                |            or an inactive task, no longer
      |    photo required, server clock             |            explains
      |    pending -> completed                     '--------------------
      v
  PATCH /task-instances/:id/review
           completed -> verified | rejected   (terminal)
```

Editing the task re-enters that loop: `PATCH /tasks/:id` runs the same insert-then-prune for that
one task immediately, so a schedule change takes effect at the moment it is made rather than
whenever the job next runs.

### 2.2 An instance's status

```
pending   -> completed
completed -> verified | rejected
```

`verified` and `rejected` are terminal. Anything not in that map is refused with **409** —
including `completed -> completed` (re-completing) and `pending -> verified` (skipping the work).

Only `pending` rows are ever deleted. The moment an instance carries a photo, a completer or a
review decision, it is a record of work that happened and nothing in the system removes it.

### 2.3 What `active` means

`active` means **"generates new instances and accepts new completions"** — not "exists". Flipping
it to `false` cancels the task's outstanding work, and what happens next depends on the kind:

| | recurring task | one-off task |
| --- | --- | --- |
| pending rows | **deleted** — the rule can regenerate them | **kept**, merely hidden |
| appears in the list | no | no |
| completion | refused, **409** | refused, **409** |
| review of already-completed work | still allowed | still allowed |
| completed / verified / rejected history | untouched, still listed | untouched, still listed |
| reactivating | job rebuilds the window | rows reappear as they were |

The asymmetry is the point. Deleting a recurring task's rows is safe because the insert pass can
put them back; a one-off's single instance is authored at creation and nothing would ever recreate
it, so deleting it would strand the task forever — it would exist with no instance, and workers
only ever see instances.

**Review is deliberately not gated on `active`.** An instance already sitting in `completed` when
its task was deactivated must keep its route to verified or rejected, or the photo sits there with
nobody able to sign it off.

### 2.4 Overdue work is never swept away

The prune only ever looks at rows from **today onwards**. A pending instance whose due date has
passed is the record that work was assigned and not done — for a system built on photo proof of
completion, that is the finding a manager most needs, and it exists nowhere else in the schema. It
stays until someone completes it.

### 2.5 What can and cannot be edited

`PATCH /tasks/:id` accepts `title`, `description`, `assigned_to`, `assigned_role_id`, `active` and
the recurrence pair. Two rules govern the schedule:

1. **`is_recurring` and `recurrence` move together or not at all.** Sent alone, neither describes
   the resulting schedule — `{ is_recurring: true }` is valid only if the stored rule is non-null,
   and `{ recurrence: null }` only if the task is not recurring. The body simply does not say.
2. **`is_recurring` cannot change.** A task is one-off or recurring from creation. Recurring →
   one-off has no date to land on, since a one-off's date lives in its single instance and PATCH
   carries no `due_date`. One-off → recurring would either delete the hand-entered instance or
   leave a date the new rule does not explain. Restating the current value is not a change and is
   allowed, which is what lets rule 1 coexist with this one.

So editing a recurring task's rule means sending `{"is_recurring": true, "recurrence": "..."}` —
restating the kind alongside the new rule. To change a task's kind, create a new task.

---

## 3. The idempotency guarantee

A unique constraint is what makes instance generation safe to repeat:

```sql
CREATE UNIQUE INDEX "task_instances_task_id_due_date_key"
  ON "task_instances"("task_id", "due_date");
```

Every instance insert uses `skipDuplicates: true`, which Prisma compiles to `ON CONFLICT DO
NOTHING`. Task creation fills a 14-day window; the daily job re-fills the same 14-day window every
run. The ~13 days of overlap are absorbed by the constraint.

The prune half is idempotent for a different reason: it deletes only what the current rule fails to
explain, so a second run finds nothing left to remove. Together they make the job **convergent** —
the state ends up the same no matter how often it runs or how many days it misses.

`reconcileInstances` refuses a backdated `today` with a `RangeError`. The parameter exists to make
a run deterministic, not to replay an earlier day: with `from` in the past the window closes before
most forward rows and the prune would delete instances that are still due.

**Verified:** job run #1 created 28 instances, deleted 0. Runs #2 and #3: **0 and 0**.

---

## 4. Files

### New

| File | What it does |
| --- | --- |
| `src/lib/recurrence.ts` | `getDates(rule, from, to)`, `surplusInstanceIds(dates, rows)`, `WINDOW_DAYS = 14`, `addDays`, `toUtcDate`. Pure — no clock, no DB. |
| `src/lib/task-status.ts` | The status transition map + `assertTransition`. One source of truth for what may follow what. |
| `src/lib/storage.ts` | Saves an uploaded photo to `uploads/`. Validates type and size, generates the filename. |
| `src/types/date-only.ts` | `DateOnlySchema` — parses `YYYY-MM-DD` to UTC midnight. |
| `src/types/task-instance.ts` | Zod schemas for filters/complete/review + response shapes. |
| `src/repository/task-instance-repository.ts` | All instance SQL: list, detail, guarded writes, idempotent inserts, the prune queries. |
| `src/services/task-instance-service.ts` | Permission rules, status rules, server-clock timestamps. |
| `src/jobs/top-up-instances.ts` | The daily job entrypoint — insert, prune, then sweep cancelled tasks. |
| `src/app/api/task-instances/route.ts` | `GET` list |
| `src/app/api/task-instances/[instanceId]/route.ts` | `GET` one |
| `src/app/api/task-instances/[instanceId]/complete/route.ts` | `PATCH` complete |
| `src/app/api/task-instances/[instanceId]/review/route.ts` | `PATCH` review |
| `src/exceptions/*` | `forbidden-error` (+3 subclasses), `invalid-recurrence-error`, `invalid-status-transition-error`, `task-instance-not-found-error`, `user-not-at-branch-error`, `photo-required-error`, `inactive-task-error`, `invalid-schedule-change-error` |
| `src/lib/recurrence.test.ts`, `src/lib/task-status.test.ts`, `src/types/task.test.ts`, `src/repository/task-instance-repository.test.ts`, `src/services/task-service.test.ts`, `src/services/task-instance-service.test.ts` | 124 unit tests across 6 suites |
| `jest.config.js` | ts-jest, compiles to CommonJS in memory only |
| `src/prisma/migrations/20260812090000_task_instance_unique_task_due_date/` | The unique constraint |

### Modified

| File | Change |
| --- | --- |
| `src/prisma/schema.prisma` | `@@unique([taskId, dueDate])` on `TaskInstance`; documented what `Task.active` means |
| `src/types/task.ts` | `CreateTaskSchema` with the two either/or rules; `UpdateTaskSchema` gained rule parsing + the pairing rule |
| `src/repository/tasks-repository.ts` | Added `createTask` (transaction) and `getActiveRecurringTasks` |
| `src/services/task-service.ts` | Added `createTask`, `reconcileInstances` (insert + prune), and instance reconciliation on `updateTask` |
| `src/app/api/tasks/route.ts` | Added `POST` |
| `src/app/api/tasks/[taskId]/route.ts` | `InvalidScheduleChangeError` → 400 |
| `src/prisma/seed.ts` | Added today-relative instances, incl. one awaiting review |
| `package.json` | Added `test` and `job:top-up` scripts; jest devDependencies |
| `.gitignore` | Added `/uploads/` |

---

## 5. The rules

### Status codes

| Code | Meaning |
| --- | --- |
| 400 | Bad input — validation, unknown branch/role, assignee not at the branch, bad photo, unparseable recurrence, changing `is_recurring` |
| 403 | Permission — not the assignee, not at the branch, reviewing your own work |
| 404 | No such task or instance |
| 409 | Wrong-status transition, or completing an instance of a deactivated task |

Completing a cancelled task is **409, not 403**: the caller may be entirely the right person, and
it is the task's state that conflicts. A 403 would send them looking for a permission fix that does
not exist.

### Permissions

- **Complete** — the task must be `active`. Person-targeted task: only `assigned_to`.
  Role-targeted task: an **active** user holding that role who works at the task's branch.
- **Review** — an active user attached to the task's branch, who is **not** `completed_by`.
  Not gated on the task being active — see §2.3. See §9, gap 1.

### Timestamps

`completed_at` and `reviewed_at` come from the **server clock**. No timestamp is accepted from the
request body, and none is read from photo EXIF.

---

## 6. Running it

```bash
docker compose up -d          # Postgres
npx prisma migrate deploy     # apply migrations
npx prisma db seed            # wipe + reload sample data (re-runnable)
npm run dev                   # http://localhost:3000

npm test                      # 124 unit tests
npx tsc --noEmit
npm run lint
npm run job:top-up            # the daily job — safe to run repeatedly
```

Point cron at `npm run job:top-up` once a day. Running it twice, or late, changes nothing extra.

> Scripts that touch the database need `import 'dotenv/config'` before importing `src/lib/db.ts` —
> it reads `DATABASE_URL` at import time and does not load `.env` itself. Next and the job already
> handle this. Without it the failure is an opaque
> `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`.

---

## 7. Postman setup

### ⚠️ Read this first — IDs are not stable

The seed does `deleteMany` then re-creates every row. The columns are `autoincrement`, so **IDs
climb on every re-seed**. After one seed the users might be 26–32; after the next, 33–39. Never
hardcode them.

### Environment variables

Every URL below is `http://localhost:3000` — the `npm run dev` default. If you start the server on
another port, adjust accordingly.

The IDs still need to be variables, because they change on every re-seed. Create a Postman
environment with:

| Variable | Value |
| --- | --- |
| `managerId` | *(filled in below)* |
| `workerId` | *(filled in below)* |
| `otherWorkerId` | *(filled in below)* |
| `stockerId` | *(filled in below)* |
| `branchId` | *(filled in below)* |
| `stockerRoleId` | *(filled in below)* |
| `instanceId` | *(filled in below)* |
| `taskId` | *(filled in below)* |

### Step 0 — discover your IDs

Run these four and fill the variables in from the responses.

```
GET http://localhost:3000/api/users
GET http://localhost:3000/api/roles
GET http://localhost:3000/api/branches
GET http://localhost:3000/api/task-instances
```

Map them like this:

- `managerId` → the **Alice Manager** row's `userId`
- `workerId` → **Bob Cashier**
- `otherWorkerId` → **Carol Cashier**
- `stockerId` → **Frank Stocker**
- `branchId` → **Main Branch**'s `branchId`
- `stockerRoleId` → the **stocker** row's `roleId`
- `instanceId` → from `GET /api/task-instances`, an instance whose `status` is `pending`
  and whose `task.assigned_to` equals your `workerId`
- `taskId` → that instance's `task_id`

> Alice, Bob and Carol are all at Main Branch. Diana is at **Downtown** — she is the one to use
> for "wrong branch" tests. Grace is a stocker but **inactive**, and at Downtown.

---

## 8. The requests

### 8.1 `GET /api/task-instances` — the worker's daily list

```
GET http://localhost:3000/api/task-instances
GET http://localhost:3000/api/task-instances?user_id={{workerId}}
GET http://localhost:3000/api/task-instances?date=2026-08-12
GET http://localhost:3000/api/task-instances?branch_id={{branchId}}
GET http://localhost:3000/api/task-instances?status=pending
GET http://localhost:3000/api/task-instances?user_id={{workerId}}&status=pending&date=2026-08-12
```

All filters are optional and combine with AND. `user_id` returns tasks addressed to that person
**plus** tasks addressed to their role at a branch they work at.

Every one of them also hides pending instances of deactivated tasks, while leaving completed,
verified and rejected rows visible — see §2.3.

Response row:

```json
[
  {
    "instance_id": 6,
    "task_id": 2,
    "due_date": "2026-08-12",
    "status": "pending",
    "completed_by": null,
    "completed_at": null,
    "reviewed_by": null,
    "reviewed_at": null,
    "task": {
      "task_id": 2,
      "title": "Restock shelves",
      "description": "Restock the front aisle shelves before opening.",
      "branch_id": 3,
      "branch_name": "Main Branch",
      "assigned_to": 28,
      "assigned_role_id": null
    },
    "assignee": { "user_id": 28, "name": "Bob Cashier" },
    "latest_photo": null
  }
]
```

**Expect 400:**

```
GET http://localhost:3000/api/task-instances?date=2026-02-31     -> "Must be a real calendar date"
GET http://localhost:3000/api/task-instances?status=bogus        -> lists the four valid statuses
GET http://localhost:3000/api/task-instances?user_id=abc         -> expected number
```

### 8.2 `GET /api/task-instances/:id` — one instance

```
GET http://localhost:3000/api/task-instances/{{instanceId}}
```

Same joins, but `latest_photo` is replaced by `media` — **every** photo, newest first.

```
GET http://localhost:3000/api/task-instances/abc      -> 400 "Invalid instanceId"
GET http://localhost:3000/api/task-instances/99999    -> 404 "Task instance not found"
```

> This route fetches by id and does not apply the list's cancellation filter, so a hidden instance
> is still reachable if you know its id. See §9, gap 3.

### 8.3 `POST /api/tasks` — create a task

Body → **raw / JSON**.

**One-off** (creates exactly 1 instance, on `due_date`):

```json
{
  "title": "Mop aisle 3",
  "description": "End of shift",
  "branch_id": {{branchId}},
  "assigned_to": {{workerId}},
  "assigned_by": {{managerId}},
  "is_recurring": false,
  "due_date": "2026-08-14"
}
```

**Recurring, weekly** (creates one instance per matching day in the next 14 days):

```json
{
  "title": "Deep clean freezers",
  "branch_id": {{branchId}},
  "assigned_to": {{workerId}},
  "assigned_by": {{managerId}},
  "is_recurring": true,
  "recurrence": "weekly:mon,wed"
}
```

**Recurring, role-targeted** (15 instances — today plus 14 days):

```json
{
  "title": "Sweep entrance",
  "branch_id": {{branchId}},
  "assigned_role_id": {{stockerRoleId}},
  "assigned_by": {{managerId}},
  "is_recurring": true,
  "recurrence": "daily"
}
```

Returns **201** with the task. Then confirm the instances exist:
`GET http://localhost:3000/api/task-instances` and filter by the returned `task_id`.

**Every one of these returns 400:**

| Body change | Message |
| --- | --- |
| both `assigned_to` and `assigned_role_id` | Provide exactly one of assigned_to or assigned_role_id |
| neither | Provide exactly one of assigned_to or assigned_role_id |
| `is_recurring: false`, no `due_date` | A one-off task requires a due_date |
| `is_recurring: false` + `recurrence` | A one-off task must have a null recurrence |
| `is_recurring: true`, `recurrence: "monthly"` | Recurrence must be 'daily' or 'weekly:\<days\>' |
| `is_recurring: true` + `due_date` | A recurring task must not carry a due_date |
| `assigned_to` who isn't at `branch_id` | Assigned user does not work at this branch |
| `branch_id: 999` | Branch not found |
| `assigned_role_id: 999` | Role not found |

Valid recurrence rules: `daily`, `weekly:mon`, `weekly:mon,wed,fri` — any of
`sun mon tue wed thu fri sat`. Case and spaces are tolerated.

### 8.4 `PATCH /api/tasks/:id` — edit or cancel a task

Body → raw / JSON. Every field is optional, but the body must not be empty.

**Cancel a task** — this is the closest thing to a delete; there is no `DELETE` endpoint:

```json
{ "active": false }
```

For a recurring task, the response is immediate: its pending instances from today onwards are
gone, and `GET /api/task-instances` no longer lists them. Its completed and verified rows stay.
Send `{ "active": true }` to bring it back — the window is rebuilt on the spot.

**Change the schedule** — both fields, always:

```json
{ "is_recurring": true, "recurrence": "weekly:mon" }
```

Narrowing a rule takes effect at once. A task that was `daily` with 15 pending rows in the window
drops to just the Mondays; overdue rows and anything already completed are untouched.

**Everything else** — a title or assignment edit does no instance work at all:

```json
{ "title": "Restock shelves (front aisle only)" }
```

**Expect 400:**

| Body | Message |
| --- | --- |
| `{}` | At least one field must be provided |
| `{"recurrence": "weekly:mon"}` | Send is_recurring and recurrence together: neither describes the resulting schedule on its own |
| `{"is_recurring": true}` | *(same message, blamed on `recurrence`)* |
| `{"is_recurring": true, "recurrence": "monthly"}` | Recurrence must be 'daily' or 'weekly:\<days\>' |
| `{"is_recurring": true, "recurrence": null}` | A recurring task requires a recurrence rule |
| `{"is_recurring": false, "recurrence": "daily"}` | A one-off task must have a null recurrence |
| `{"is_recurring": false, "recurrence": null}` on a **recurring** task | A task's is_recurring cannot be changed after creation … Create a new task instead. |
| `{"is_recurring": true, "recurrence": "daily"}` on a **one-off** task | *(same message)* |

`404` for an unknown `taskId`, and nothing is written when a request is refused.

### 8.5 `PATCH /api/task-instances/:id/complete` — do the work

**This one is multipart, not JSON.** In Postman: Body → **form-data**.

| Key | Type | Value |
| --- | --- | --- |
| `photo` | **File** | pick any `.jpg` / `.png` / `.webp` / `.heic` |
| `completed_by` | Text | `{{workerId}}` |

> Set the `photo` row's type to **File** using the dropdown that appears when you hover the key
> field. If it stays as Text you will get `400 A photo is required`.

```
PATCH http://localhost:3000/api/task-instances/{{instanceId}}/complete
```

**200** returns the updated instance with `status: "completed"`, a server-set `completed_at`, and
the new row in `media`.

Test the guards:

| Change | Expected |
| --- | --- |
| `completed_by` = `{{otherWorkerId}}` | **403** Only the assignee may complete this task instance |
| remove the `photo` row | **400** A photo is required to complete a task instance |
| upload a `.txt` as `photo` | **400** Unsupported photo type 'text/plain' |
| remove `completed_by` | **400** expected number |
| send it a second time | **409** Cannot change ... from 'completed' to 'completed' |
| after `PATCH /tasks/:id {"active": false}` | **409** This task is no longer active |
| id `99999` | **404** Task instance not found |

For a **role-targeted** instance (one where `task.assigned_role_id` is set), `completed_by` must
be an active holder of that role at that branch — `{{stockerId}}` works, `{{workerId}}` (a
cashier) gets **403**.

Photos land in `uploads/` at the project root, under a generated filename. The directory is
gitignored, and sits outside `public/` so photos are not publicly served.

### 8.6 `PATCH /api/task-instances/:id/review` — verify or reject

Body → raw / JSON. Needs an instance whose status is `completed` — the seed leaves one ready, or
run 8.5 first.

```json
{ "decision": "verified", "reviewed_by": {{managerId}} }
```

```json
{ "decision": "rejected", "reviewed_by": {{managerId}} }
```

```
PATCH http://localhost:3000/api/task-instances/{{instanceId}}/review
```

Test the guards:

| Change | Expected |
| --- | --- |
| `reviewed_by` = the user who completed it | **403** You may not review a task instance you completed yourself |
| `reviewed_by` = Diana (Downtown) | **403** You are not attached to the branch this task belongs to |
| `reviewed_by` = Grace (inactive) | **403** |
| `reviewed_by: 999` | **403** |
| `decision: "maybe"` | **400** expected one of "verified" \| "rejected" |
| no `reviewed_by` | **400** expected number |
| run against a `pending` instance | **409** Cannot change ... from 'pending' to 'verified' |
| run twice | **409** Cannot change ... from 'verified' to 'rejected' |
| after the task is deactivated | **200** — deliberate, see §2.3 |

---

## 9. Known gaps — deliberate, not oversights

Also recorded in `TO-BE-REVIEWED.md`.

1. **The reviewer is not checked for being a manager.** Review currently requires an active user
   attached to the branch who isn't the completer. Role-based permissions were deferred, so today
   a cashier at Main can review a colleague's work at Main. The hook is
   `TaskInstanceService.assertMayReview`.

2. **The acting user is a request field, not a session.** `assigned_by`, `completed_by` and
   `reviewed_by` are read from the request and believed. The rules are enforced; the identity
   behind them is not yet trustworthy. When auth lands, these three come off the payloads and the
   services take the session user — the service signatures already accept the id as an argument.

3. **`GET /api/task-instances/:id` does not apply the cancellation filter.** The list hides pending
   instances of deactivated tasks; fetching one by id does not. A manager following a link to
   cancelled work seeing it is defensible, but the two paths disagree.

4. **`updateTask` is three statements, not one transaction.** It reads the task, writes it, then
   reconciles the instances. A failure between the write and the reconcile leaves the task updated
   with stale instances until the next job run repairs it. The self-healing is the mitigation, not
   an accident — but it is a window.

5. **A rule change is applied per task, not diffed against instance history.** Narrowing a rule
   deletes the pending rows it no longer covers; it does not attempt to explain or annotate what
   was removed. If an audit trail of schedule changes is ever needed, that is a new table.

---

## 10. Verification log

`npm test` (124 unit tests, 6 suites), `npx tsc --noEmit` and `npm run lint` all pass. Beyond that,
the behaviour above was exercised against the live database:

| Check | Result |
| --- | --- |
| Job on a fresh seed | 28 created, 0 deleted; window `08-13 .. 08-27` |
| Job re-run | 0 created, 0 deleted — convergent |
| List filters, incl. branch + role filters together | Correct rows for every combination |
| Deactivate a recurring task | 16 pending → 1 (the overdue row); verified row untouched |
| Deactivate a one-off task | Rows kept in the table, 0 listed |
| Reactivate the recurring task | Full window rebuilt immediately |
| `PATCH` narrowing `daily` → `weekly:mon` | 17 rows → 4: verified + overdue + the two Mondays |
| Completed instance on a date the new rule excludes | Survived the prune, media intact |
| Pending instance on the same excluded date | Removed |
| All six `PATCH /tasks/:id` rejections | 400 with the intended message |
| Backdated `reconcileInstances` | `RangeError`, row count unchanged |
