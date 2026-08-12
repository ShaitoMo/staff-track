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

---

## 2. The idempotency guarantee

A unique constraint is what makes instance generation safe to repeat:

```sql
CREATE UNIQUE INDEX "task_instances_task_id_due_date_key"
  ON "task_instances"("task_id", "due_date");
```

Every instance insert uses `skipDuplicates: true`, which Prisma compiles to `ON CONFLICT DO
NOTHING`. Task creation fills a 14-day window; the daily job re-fills the same 14-day window every
run. The ~13 days of overlap are absorbed by the constraint.

**Verified:** job run #1 created 28 instances. Runs #2 and #3 created **0**.

---

## 3. Files

### New

| File | What it does |
| --- | --- |
| `src/lib/recurrence.ts` | `getDates(rule, from, to)`, `WINDOW_DAYS = 14`, `addDays`, `toUtcDate`. Pure — no clock, no DB. |
| `src/lib/task-status.ts` | The status transition map + `assertTransition`. One source of truth for what may follow what. |
| `src/lib/storage.ts` | Saves an uploaded photo to `uploads/`. Validates type and size, generates the filename. |
| `src/types/date-only.ts` | `DateOnlySchema` — parses `YYYY-MM-DD` to UTC midnight. |
| `src/types/task-instance.ts` | Zod schemas for filters/complete/review + response shapes. |
| `src/repository/task-instance-repository.ts` | All instance SQL: list, detail, guarded writes, idempotent inserts. |
| `src/services/task-instance-service.ts` | Permission rules, status rules, server-clock timestamps. |
| `src/jobs/top-up-instances.ts` | The daily job entrypoint. |
| `src/app/api/task-instances/route.ts` | `GET` list |
| `src/app/api/task-instances/[instanceId]/route.ts` | `GET` one |
| `src/app/api/task-instances/[instanceId]/complete/route.ts` | `PATCH` complete |
| `src/app/api/task-instances/[instanceId]/review/route.ts` | `PATCH` review |
| `src/exceptions/*` | `forbidden-error` (+3 subclasses), `invalid-recurrence-error`, `invalid-status-transition-error`, `task-instance-not-found-error`, `user-not-at-branch-error`, `photo-required-error` |
| `src/lib/recurrence.test.ts`, `src/lib/task-status.test.ts` | 47 unit tests |
| `jest.config.js` | ts-jest, compiles to CommonJS in memory only |
| `src/prisma/migrations/20260812090000_task_instance_unique_task_due_date/` | The unique constraint |

### Modified

| File | Change |
| --- | --- |
| `src/prisma/schema.prisma` | `@@unique([taskId, dueDate])` on `TaskInstance` |
| `src/types/task.ts` | Added `CreateTaskSchema` with the two either/or rules |
| `src/repository/tasks-repository.ts` | Added `createTask` (transaction) and `getActiveRecurringTasks` |
| `src/services/task-service.ts` | Added `createTask` and `topUpRecurringInstances` |
| `src/app/api/tasks/route.ts` | Added `POST` |
| `src/prisma/seed.ts` | Added today-relative instances, incl. one awaiting review |
| `package.json` | Added `test` and `job:top-up` scripts; jest devDependencies |
| `.gitignore` | Added `/uploads/` |

---

## 4. The rules

### Status transitions

```
pending   -> completed
completed -> verified | rejected
```

`verified` and `rejected` are terminal. Anything not in that map is refused with **409** —
including `completed -> completed` (re-completing) and `pending -> verified` (skipping the work).

### Status codes

| Code | Meaning |
| --- | --- |
| 400 | Bad input — validation, unknown branch/role, assignee not at the branch, bad photo |
| 403 | Permission — not the assignee, not at the branch, reviewing your own work |
| 404 | No such instance |
| 409 | Wrong-status transition |

### Permissions

- **Complete** — person-targeted task: only `assigned_to`. Role-targeted task: an **active** user
  holding that role who works at the task's branch.
- **Review** — an active user attached to the task's branch, who is **not** `completed_by`.
  See §8, gap 1.

### Timestamps

`completed_at` and `reviewed_at` come from the **server clock**. No timestamp is accepted from the
request body, and none is read from photo EXIF.

---

## 5. Running it

```bash
docker compose up -d          # Postgres
npx prisma migrate deploy     # apply migrations
npx prisma db seed            # wipe + reload sample data (re-runnable)
npm run dev                   # http://localhost:3000

npm test                      # 47 unit tests
npm run lint
npm run job:top-up            # the daily job — safe to run repeatedly
```

Point cron at `npm run job:top-up` once a day. Running it twice, or late, changes nothing extra.

---

## 6. Postman setup

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

> Alice, Bob and Carol are all at Main Branch. Diana is at **Downtown** — she is the one to use
> for "wrong branch" tests. Grace is a stocker but **inactive**, and at Downtown.

---

## 7. The requests

### 7.1 `GET /api/task-instances` — the worker's daily list

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

### 7.2 `GET /api/task-instances/:id` — one instance

```
GET http://localhost:3000/api/task-instances/{{instanceId}}
```

Same joins, but `latest_photo` is replaced by `media` — **every** photo, newest first.

```
GET http://localhost:3000/api/task-instances/abc      -> 400 "Invalid instanceId"
GET http://localhost:3000/api/task-instances/99999    -> 404 "Task instance not found"
```

### 7.3 `POST /api/tasks` — create a task

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

### 7.4 `PATCH /api/task-instances/:id/complete` — do the work

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
| id `99999` | **404** Task instance not found |

For a **role-targeted** instance (one where `task.assigned_role_id` is set), `completed_by` must
be an active holder of that role at that branch — `{{stockerId}}` works, `{{workerId}}` (a
cashier) gets **403**.

Photos land in `uploads/` at the project root, under a generated filename. The directory is
gitignored, and sits outside `public/` so photos are not publicly served.

### 7.5 `PATCH /api/task-instances/:id/review` — verify or reject

Body → raw / JSON. Needs an instance whose status is `completed` — the seed leaves one ready, or
run 7.4 first.

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

---

## 8. Known gaps — deliberate, not oversights

Also recorded in `TO-BE-REVIEWED.md`.

1. **The reviewer is not checked for being a manager.** Review currently requires an active user
   attached to the branch who isn't the completer. Role-based permissions were deferred, so today
   a cashier at Main can review a colleague's work at Main. The hook is
   `TaskInstanceService.assertMayReview`.

2. **The acting user is a request field, not a session.** `assigned_by`, `completed_by` and
   `reviewed_by` are read from the request and believed. The rules are enforced; the identity
   behind them is not yet trustworthy. When auth lands, these three come off the payloads and the
   services take the session user — the service signatures already accept the id as an argument.

3. **The repo cannot type check.** `tsconfig.json` sets `"ignoreDeprecations": "6.0"`, which
   TypeScript 5.9.3 rejects (TS5103); `npx tsc` and `next build` both fail before reading a file.
   This predates this feature. Fix by removing the line or setting `"5.0"`. Verification here was
   `npm test`, `npm run lint`, and exercising every endpoint against a live database.
