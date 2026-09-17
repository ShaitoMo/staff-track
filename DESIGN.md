---
name: StaffTrack
description: Internal ops console for a multi-branch market chain — scheduling, tasks, attendance, and coverage.
colors:
  market-blue: "#1E90FF"
  ledger-ink: "#16191B"
  slate: "#5B6368"
  paper: "#F8FAFA"
  card: "#FFFFFF"
  hairline: "#E2E5E4"
typography:
  display:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.02em"
  mono:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "0.27rem"
  md: "0.36rem"
  lg: "0.45rem"
  xl: "0.63rem"
components:
  button-primary:
    backgroundColor: "{colors.market-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2rem"
  button-primary-hover:
    backgroundColor: "{colors.market-blue}"
    textColor: "#FFFFFF"
---

# Design System: StaffTrack

## Overview

**Creative North Star: "The Back-Office Ledger"**

StaffTrack is the room behind the counter, not the storefront: an owner or manager's working surface for scheduling, task oversight, attendance, and coverage across branches of a market chain. The system is quiet and dense rather than expressive — closer to a well-run ledger or a register terminal than a marketing product. Its job is to make status legible at a glance across many rows (shifts, tasks, staff, branches) and to get a manager in and out of a task fast, not to hold attention.

One deliberate exception carries the brand: a single confident blue accent, used sparingly for primary actions and interactive state. Everything else is neutral. Staff-facing screens (viewed on a phone, on shift) get the same restraint but larger touch targets and less information density per screen than manager/owner screens.

**Key Characteristics:**
- Restrained: neutral slate ground, one committed accent, no decorative color
- Dense and scannable for manager/owner screens; simplified and touch-first for staff screens
- Flat by default — structure comes from borders and spacing, not shadows
- A workhorse UI typeface, not a display face; nothing here performs personality through type

## Colors

Restrained strategy: a neutral slate palette carries the whole system; one accent is spent deliberately, not scattered.

### Primary
- **Market Blue** (`#1E90FF`): the one committed accent. Primary buttons, active nav item, links, focus rings. Used on a small minority of any given screen — its rarity is what makes it read as the thing to act on.

### Neutral
- **Ledger Ink** (`#16191B`): primary text.
- **Slate** (`#5B6368`): secondary/muted text, placeholder text.
- **Paper** (`#F8FAFA`): app background.
- **Card** (`#FFFFFF`): surface background (cards, table rows, panels) against Paper.
- **Hairline** (`#E2E5E4`): borders, dividers, table rules.

### Semantic (functional, not brand)
Destructive, warning, success/verified, and informational states use shadcn's default semantic palette (e.g. destructive `oklch(0.577 0.245 27.325)`, used on the login page's error `Alert`) rather than custom values — these communicate system status, not brand character, and don't count against the one-accent restraint. (Success/verified reads as green per convention — distinct from the Market Blue brand accent, not a competitor to it.)

### Named Rules
**The One Accent Rule.** Market Blue appears only on the primary action per view and on interactive/focus state. Never as a background fill for large regions, never as a second competing accent elsewhere on the same screen, and never doing double duty as a status color.

## Typography

**UI Font:** Geist Sans (`next/font/google`, wired in `src/app/layout.tsx` as `--font-geist-sans`), system-ui fallback.
**Tabular/Mono Font:** Geist Mono (`--font-geist-mono`), for IDs, phone numbers, timestamps, and anything meant to align in a column.

**Character:** A plain, highly legible grotesque built for interfaces, not editorial display — chosen because it's already the project's font and because Operate-mode surfaces are better served by a workhorse face than an expressive one.

### Hierarchy
- **Display** (600, 20px, 1.25 line-height): card titles, page/section titles (e.g. the login card's "StaffTrack" title).
- **Body** (400, 14px, 1.5 line-height): default UI text, form labels, descriptions, table cells.
- **Label** (500, 12px, 1.35 line-height, 0.02em tracking): table headers, field labels, status chips.

### Named Rules
**The No-Display-Face Rule.** Nothing on an Operate screen is set in a font chosen for personality. If a heading wants more presence, that's a weight/size change, never a new typeface.

## Layout

A persistent header (currently: app name, role, log out) plus a content area is the base shell for manager/owner screens (`src/app/(app)/layout.tsx`) — it will grow into a full sidebar as more sections are added, keeping orientation constant across a data-heavy, many-section app. Content density is high: compact row heights, minimal padding between related fields, generous padding only around page-level containers.

The login page is a single centered `Card` (`max-w-sm`) on the bare `Paper` background — deliberately the simplest possible surface, since it's the one screen with no navigation and no session yet.

Staff-facing screens (shift list, task list/detail, task completion — not yet built) drop the sidebar for a single-column, mobile-first layout with larger touch targets and one primary action per screen — these are used standing up, on a phone, mid-shift, not at a desk.

## Elevation & Depth

Flat by default. Structure comes from the Hairline border and background-color steps (Paper vs. Card), not shadows. Shadows are reserved for genuinely elevated, temporary surfaces — dropdown menus, dialogs, toasts — never for resting cards or table rows. (shadcn's `Card` primitive ships a `ring-1 ring-foreground/10` rather than a shadow, which fits this system's flat-by-default rule.)

### Named Rules
**The Flat-By-Default Rule.** A card or table row sitting in its normal place never has a shadow. A shadow means "this is floating above the page right now" (a menu, a modal), not "this is a card."

## Shapes

Modest, slightly restrained corner rounding — `--radius: 0.45rem` (~7px) as the base, yielding `sm` 0.27rem (~4px), `md` 0.36rem (~6px, buttons/inputs), `lg` 0.45rem (~7px, cards), `xl` 0.63rem (~10px). Enough to feel current, not soft or playful. Table containers and dense data regions may use `sm` or no rounding to reinforce the ledger/ops feel. Borders are 1px Hairline; no heavy or double borders.

## Components

### Buttons
- **Shape:** `rounded-lg` at the button-group level, `md` radius (0.36rem) at most individual sizes.
- **Primary** (`variant="default"`): `bg-primary` / `text-primary-foreground` — Market Blue fill, white text. Used for exactly one action per view (e.g. "Sign in").
- **Hover / Focus:** hover fades to `bg-primary/80`; focus shows a `--ring` (Market Blue) 3px ring via `focus-visible:ring-3 focus-visible:ring-ring/50`.
- **Outline / Secondary / Ghost / Destructive:** available (`src/components/ui/button.tsx`) for lower-emphasis and dangerous actions; not yet used in shipped UI beyond `Logout` (`variant="outline"`).
- **Pending state:** no built-in loading prop — compose `Spinner` (`data-icon="inline-start"`) + `disabled`, as done on the login button.

### Cards
- **Corner Style:** `rounded-xl` (0.63rem).
- **Background:** `Card` (`#FFFFFF`) against the `Paper` page background.
- **Shadow Strategy:** none — `ring-1 ring-foreground/10` instead, per Elevation & Depth.
- **Composition:** `CardHeader` (`CardTitle` + `CardDescription`) then `CardContent`; used on the login page exactly this way, nothing added to `CardContent` beyond the form.

### Inputs / Fields
- **Style:** `Input` is a plain bordered field (`Hairline` border, `Paper`-adjacent background); always wrapped in `Field` + `FieldLabel` from `src/components/ui/field.tsx`, never a raw `<label>`/`<input>` pair.
- **Focus:** border shifts to `--ring` with a soft 3px ring, matching Button's focus treatment for consistency.
- **Error state:** field-level errors use `data-invalid` on `Field` + `aria-invalid` on the control (per the shadcn convention); the login page instead uses a form-level `Alert` since a credential rejection isn't attributable to one specific field.

### Alerts
- **Style:** `variant="destructive"` — `Card`-colored background, destructive-red icon and text, used for the login page's "Invalid phone or password" message. No decorative border color beyond the default.

## Do's and Don'ts

### Do:
- **Do** spend Market Blue on exactly one primary action per view.
- **Do** default to borders and spacing for structure, not shadows.
- **Do** keep staff-facing (phone) screens to one primary action and larger touch targets than manager/owner screens.
- **Do** use Geist Mono for anything meant to align in a column (times, IDs, phone numbers).
- **Do** wrap every form control in `Field` + `FieldLabel`, never a raw `div`/`label`.

### Don't:
- **Don't** introduce a second decorative accent color alongside Market Blue.
- **Don't** use a display/serif/expressive typeface anywhere in this system — this is an Operate surface, not a marketing one.
- **Don't** add shadows to resting cards, table rows, or sidebar items.
- **Don't** reduce information density on manager/owner screens to chase a "cleaner" look at the cost of scanability.
- **Don't** attach a credential/login error to one field when it isn't attributable to it — use a form-level `Alert` instead.
