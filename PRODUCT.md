# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are **owners and managers**, who run day-to-day operations across multiple branches of a market/retail chain: scheduling shifts, assigning and reviewing tasks, tracking attendance, and monitoring coverage. Owners see and act across all branches; managers are scoped to their own branch(es).

Frontline staff (cashiers, stockers, and similar branch roles) are a secondary but load-bearing audience with lighter, more frequent touchpoints: viewing their own shifts, viewing/completing assigned tasks with a required photo, seeing their own attendance. They interact on shift, on the floor — often on a phone, not at a desk.

## Product Purpose

StaffTrack replaces manual/paper or spreadsheet-based processes for running a multi-branch market chain's staff operations: shift scheduling, attendance tracking, task assignment and completion with photo verification, and coverage-requirement monitoring per branch/role/period.

## Positioning

Combines branch-scoped role-based access (owner sees everything; managers scoped to their own branches; staff scoped to themselves) with an auditable task-completion trail (required photo proof, a review/verify-or-reject workflow) and coverage-gap detection — one system for scheduling, task oversight, and attendance instead of separate spreadsheets/tools that don't share a branch/role model.

## Operating Context

Multiple physical branch locations belonging to one market/retail chain, each with its own registers and role-based staffing (cashier, stocker, and similar). Shifts are organized into periods; tasks can be one-off or recurring, assigned to a person or a role. Owners/managers primarily work in an office/desk setting reviewing and planning; staff act on the floor, in-shift, typically via phone.

## Capabilities and Constraints

The backend (already built, pending PR approval on branches stacked under `review`) defines the full capability set the frontend must expose:
- Users, roles, branches, registers, and per-branch/user assignment
- Shift scheduling with periods and coverage requirements per branch/role/period, with coverage-gap detection
- Tasks: one-off or recurring, assigned to a person or a role; instances have a status lifecycle (pending → completed → verified/rejected) and require a photo on completion
- Attendance: manual entry plus CSV/Excel machine-clock-in import, and a schedule-vs-actual comparison report
- A dashboard summarizing attendance/task/coverage state

Authorization is enforced entirely server-side: cookie-based JWT session (15-minute access token, 7-day refresh token), with role/branch checks (`requireRole`, `requireBranchAccess`, `requireSelfOrRole`) applied in each API route handler. The frontend must treat this as the actual security boundary — any role-based UI it shows or hides is for clarity, not enforcement — and must talk to the existing `/api/*` routes rather than bypass them.

The frontend itself does not exist yet beyond framework boilerplate; it is being built now on a dedicated `frontend` branch off the backend's `review` branch, without waiting for the 13 open backend PRs to be approved/merged.

## Brand Commitments

Name: **StaffTrack**. No other voice, visual, or asset commitments are confirmed yet.

## Evidence on Hand

No real branch, employee, or business data, screenshots, or testimonials on hand. `src/prisma/seed.ts` contains sample/placeholder data only (e.g. seeded users all have a placeholder password hash) — future work must not present seed data as real, and must not fabricate business names, employee names, or metrics.

## Product Principles

1. Manager/owner workflows (scheduling, review, oversight) are desk-oriented and can prioritize information density over touch target size.
2. Staff-facing workflows (viewing shifts/tasks, completing a task with a required photo) must work well on a phone — this is a hard constraint from day one, not a later enhancement.
3. Authorization is a backend guarantee, not a frontend one; role-based UI exists for clarity, never as the actual gate.
4. Branch-scoping is structural, not incidental — screens should read as belonging to a specific branch or branch set, matching how the business itself is organized, not as a generic multi-tenant afterthought.
5. The product exists to remove the friction that made spreadsheets/paper tempting — screens should favor fast data entry and clear at-a-glance status over replicating spreadsheet-like steps.
