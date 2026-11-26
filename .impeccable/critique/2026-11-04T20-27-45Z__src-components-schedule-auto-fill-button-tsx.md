---
target: schedule build ui
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\LENOVO\\Desktop\\project\\stafftrack\\src\\components\\schedule\\auto-fill-button.tsx"
target_fingerprint: "sha256:1ca2f054fd61bb3fbe9285f93d308b80f6f29e4a7a57609ec8d0d1e85ae646c8"
target_path: "C:\\Users\\LENOVO\\Desktop\\project\\stafftrack\\src\\components\\schedule\\auto-fill-button.tsx"
timestamp: 2026-11-04T20-27-45Z
slug: src-components-schedule-auto-fill-button-tsx
---
# Critique: schedule builder (Auto-fill week + Scheduling rules)

Method: dual-agent (A: design review · B: detector + browser)

## Heuristics: 23/40 (Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | The success message after Approve may unmount; the rules page has no unsaved-changes state |
| 2 | Match with the real world | 3 | Good domain copy; the wand icon and "Generate"/"swap" are generic tool-speak |
| 3 | User control and freedom | 2 | Esc, outside-click or Cancel silently throws away an edited proposal (auto-fill-button.tsx:60-68) |
| 4 | Consistency and standards | 3 | Checked checkboxes are Market Blue (ui/checkbox.tsx), against the CHOSEN = Ledger Ink rule; text-lg h2 is off the type scale |
| 5 | Error prevention | 2 | Past days are proposed; selects offer a single option; "Add pair" isn't saved until "Save rules" |
| 6 | Recognition rather than recall | 2 | The narrow modal blurs out the week being filled |
| 7 | Flexibility and efficiency | 2 | Auto-fill is reachable only in edit mode; no bulk actions; the cap is asked on every run |
| 8 | Aesthetic and minimalist design | 3 | Flat and restrained; "Any period" repeats while the restricted row is a blank cell |
| 9 | Error recovery | 2 | "Nobody is free" is a dead end next to a disabled "Approve 0 shifts" |
| 10 | Help and documentation | 2 | Good hints, but a short slot never links to the rule or cap that caused it |

## Priority issues
- [P1] Silent discard of an edited proposal (Esc inside a Select closes the dialog): add a dirty-check confirm and turn off outside-click on the review step
- [P1] The review modal hides the schedule: show suggestions inline in the grid with a sticky approve bar, or widen the dialog and drop the blur
- [P1] Short slots and "nobody free" don't say why: give each one a reason (no role / cap reached / rule) and a next step; put the still-short count in the summary
- [P2] Auto-fill is hidden behind edit mode: make the view-mode "N short" line actionable
- [P2] Rules editor: no dirty state, unchecked-box border 1.25:1 (fails 1.4.11), blue checked fill, no role column

## Detector
The CLI scan was clean (0). In the browser: cramped-padding and nested-cards on bordered table wrappers and the dialog footer (mostly false positives); line-length ~178 chars on the rules intro (real); overused-font Geist (by design).

## Minor
The proposal includes past dates; Arabic "اقتراح" is a noun on a button; English stillShort doesn't isolate() the role; the rules h2 repeats the branch.
