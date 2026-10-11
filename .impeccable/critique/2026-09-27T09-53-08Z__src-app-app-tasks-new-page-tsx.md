---
target: add tasks form
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\LENOVO\\Desktop\\project\\stafftrack\\src\\app\\(app)\\tasks\\new\\page.tsx"
target_fingerprint: "sha256:b8ff0999d8e2ce542ea0d3727251aa9ec8aed33c01be591d9ee2b34c27ca6656"
target_path: "C:\\Users\\LENOVO\\Desktop\\project\\stafftrack\\src\\app\\(app)\\tasks\\new\\page.tsx"
timestamp: 2026-09-27T09-53-08Z
slug: src-app-app-tasks-new-page-tsx
---
# Critique: Add task form (`/tasks/new`)

Method: dual-agent (A: adf81923f74054ae8 · B: a58972569fbfb5116)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Field errors persist after the field becomes valid |
| 2 | Match System / Real World | 3 | Clean labels undercut by raw lowercase enum values leaking into the UI |
| 3 | User Control and Freedom | 2 | No cancel/back control |
| 4 | Consistency and Standards | 3 | Faithful to conventions; undercut by its own casing inconsistency |
| 5 | Error Prevention | 2 | No warning for a staff-less branch or an all-unchecked weekly schedule |
| 6 | Recognition Rather Than Recall | 3 | Everything enumerated in selects/checkboxes |
| 7 | Flexibility and Efficiency | 1 | No duplicate/"create similar", no remembered branch |
| 8 | Aesthetic and Minimalist Design | 3 | Clean components, poor composition; detector-confirmed contrast failure on the primary button |
| 9 | Error Recovery | 1 | Stale-error bug means the message often lies about the field's actual state |
| 10 | Help and Documentation | 2 | No inline note on role fan-out or the photo requirement |
| **Total** | | **21/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict
Generic CRUD form wearing StaffTrack's tokens, not authored for multi-branch retail task dispatch. The one genuinely domain-aware interaction (branch gates the person list) has zero visual signal that it's a dependency. CLI detector: clean (0 findings) — it doesn't catch specificity. Browser overlay: font-usage flag (false positive, DESIGN.md intentionally commits to one typeface) and a real, independently-verified contrast failure (white #fff on #1e90ff = 3.2:1, needs 4.5:1) on the app's one primary-button color pair.

## What's Working
1. Branch→Person cascade (`assigneeOptionsForBranch`) — correct domain rule, under-communicated.
2. Schedule-conditional field swap (Due date ⇄ Weekdays), with the Weekdays block's `FieldSet`/`FieldLegend` grouping.
3. The One Accent Rule holds — Market Blue only on the primary action, focus rings, and checked state.

## Priority Issues
**[P0] Field errors never clear until the whole form is resubmitted** — `setErrors()` only runs inside `handleSubmit` (task-form.tsx:97); no onChange handler touches it. Breaks trust and screen-reader re-announcement. Fix: re-validate/clear per-field on change. → /impeccable harden

**[P1] The app's one primary-action color pair fails WCAG AA contrast** — `--primary`/`--primary-foreground` in globals.css is 3.2:1, systemic across every primary button. Fix: darken the blue or the button text until it clears 4.5:1. → /impeccable audit

**[P1] A staff-less branch produces a silently empty Person dropdown** — confirmed live against "PW Test Renamed": enabled, zero rows, no explanation. Fix: explicit empty-state row in SelectContent. → /impeccable clarify

**[P1] Role values render as raw lowercase enum strings** — `{role.name}` verbatim (task-form.tsx:217), surfaces in the Role select and the Tasks list next to properly-cased names. Fix: humanize for display, keep raw value as id only. → /impeccable clarify

**[P2] Flat, ungrouped layout with dead space** — 4/8 cognitive-load checklist items fail (chunking, grouping, hierarchy); one undifferentiated field list under a hard max-w-lg cap. Fix: 2-3 labeled fieldsets, consider two columns on wide viewports. → /impeccable layout

## Persona Red Flags
**Alex (Power User)**: no duplicate/"create similar" path despite visibly repeated task patterns; branch not remembered between visits; Person select has no type-ahead, untested past 5 users.
**Sam (Accessibility-Dependent)**: stale-error bug means screen readers report a field broken indefinitely; empty Person listbox has no announced reason; no confirmed focus management to the first invalid field.
**Riley (Stress Tester)**: rapidly switching Assign-to kind after a failed submit leaves stale errors stuck on the new field slot, indistinguishable from real corruption.

## Minor Observations
- No creation confirmation (silent router.push, no toast/highlight).
- Description is a single-line Input, not a Textarea.
- Native `<input type="date">` doesn't match the rest of the design system.
- No confirmed min-date constraint on Due date.
- `dueDate` retained in state when switching schedule type is harmless — `buildCreateTaskBody` nulls it correctly before sending.
- Detector's "overused-font" flag is a likely false positive (DESIGN.md's No-Display-Face Rule is intentional).

## Questions to Consider
- What if "Assign to a role" showed how many people currently hold that role at the branch?
- What if the form remembered the manager's last-used/only branch?
- What if creating a task previewed what the assignee will see, including the photo requirement?
