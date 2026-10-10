---
name: StaffTrack
description: Internal ops console for a multi-branch market chain — scheduling, tasks, attendance, and coverage.
colors:
  market-blue: "#0066CC"
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
- **Market Blue** (`#0066CC`): the one committed accent. One job: it marks what you can act on — primary buttons, links, focus rings. It never marks where you are (the nav's active item is neutral) or what's chosen in a page (Ledger Ink, below). Used on a small minority of any given screen — its rarity is what makes it read as the thing to act on. (Darkened from an earlier `#1E90FF` to clear WCAG AA 4.5:1 contrast with white button text — `/impeccable audit` flagged the original at 3.2:1.)

### Neutral
- **Ledger Ink** (`#16191B`): primary text.
- **Slate** (`#5B6368`): secondary/muted text, placeholder text.
- **Paper** (`#F8FAFA`): app background.
- **Card** (`#FFFFFF`): surface background (cards, table rows, panels) against Paper.
- **Hairline** (`#E2E5E4`): borders, dividers, table rules.
- **Ledger Ink, as a surface** (`#16191B`, the `--sidebar-*` tokens): the owner/manager left bar, the app's one dark region — text `#E6E9E8`, group labels and icons `#949C9F` (6.3:1), hover `#23282B`. It frames every manager screen so the app is recognisable at a glance, and lets the Market Blue active item read as the only color on it. Nothing else in the app sits on a dark surface.

### Semantic (functional, not brand)
Destructive, warning, success/verified, and informational states use shadcn's default semantic palette (e.g. destructive `oklch(0.577 0.245 27.325)`, used on the login page's error `Alert`) rather than custom values — these communicate system status, not brand character, and don't count against the one-accent restraint. (Success/verified reads as green per convention — distinct from the Market Blue brand accent, not a competitor to it.)

One adjustment: the destructive `Badge` (e.g. "Overdue", "Declined") sets its text in `color-mix(in oklch, var(--destructive) 85%, black)`, because the plain token on its own 10% tint measured 4.0:1 at 12px on a white card; the darker shade clears AA's 4.5:1 at 5.7:1 on a card and 5.4:1 on the `#f8fafa` page background. Dark mode keeps the plain token.

Status color marks, it doesn't fill. In the schedule grid a slot still needing someone gets a small destructive dot before muted "Needs N" text (`NEEDS_DOT`, `src/lib/schedule-grid.ts`), not a tinted cell; the weekly table on Roles & coverage uses the same dot before "0 / 1 (−1)" in plain text, not red: when most of a week is short, filled cells turned the grid pink and stopped reading as a signal. Red text is kept for real conflicts (a register with two people on it) and errors; an unstaffed register is muted, since the week's summary line already counts it.

**What gets red.** Red means a manager must act: a slot short, a no-show, a missing punch, a declined task, an error. A state that only describes something stays quiet — an inactive user is a dashed muted outline badge, not red — and approved/verified gets `--success` (`#15803d`, 5.0:1 on white) as a green outline badge (`variant="success"`), so it reads apart from Completed, which still waits on review. The dashboard follows the schedule's mark: one red summary line per branch card, a dot on each "Short: …" line and on the urgent totals, nothing else red. Attendance's badges (`attendance-status.tsx`) are the reference for how loud each state is.

**Links.** A link inside a sentence or standing alone as text is Market Blue (`text-primary`). A heading or section label that opens the page behind it (a dashboard branch name, "Attendance ›") stays in its text color with a chevron and turns blue on hover — the chevron is the affordance, so a card isn't covered in blue.

**Chosen vs. current.** Market Blue marks only what you can act on: the page's one main action, links, focus. Where you are in the app is neutral — a lighter surface and a heavier weight in the nav (below). An option chosen *inside* a page — a day in the phone day strip, a branch button, the Tasks / Instances toggle — is solid Ledger Ink on an outline control (`CHOSEN`, `src/lib/selection.ts`), so a picker never puts a second blue fill beside the main action. Active/Inactive badges are one style everywhere: plain outline for active, dashed muted outline for inactive.

### Named Rules
**The One Accent Rule.** Market Blue appears only on what can be acted on: the primary action per view, links, and focus rings — not on navigation state, selection, or status. Never as a background fill for large regions, never as a second competing accent elsewhere on the same screen, and never doing double duty as a status color.

## Typography

**UI Font:** Geist Sans (`next/font/google`, wired in `src/app/layout.tsx` as `--font-geist-sans`), system-ui fallback.
**Tabular/Mono Font:** Geist Mono (`--font-geist-mono`), for IDs, phone numbers, timestamps, and anything meant to align in a column.

**Character:** A plain, highly legible grotesque built for interfaces, not editorial display — chosen because it's already the project's font and because Operate-mode surfaces are better served by a workhorse face than an expressive one.

### Hierarchy
- **Display** (600, 20px, 1.25 line-height): card titles and every page's `h1` (`text-xl font-semibold`), e.g. the login card's "StaffTrack" title.
- **Body** (400, 14px, 1.5 line-height): default UI text, form labels, descriptions, table cells.
- **Label** (500, 12px, 1.35 line-height, 0.02em tracking): table headers, field labels, status chips.

### Named Rules
**The No-Display-Face Rule.** Nothing on an Operate screen is set in a font chosen for personality. If a heading wants more presence, that's a weight/size change, never a new typeface.

## Layout

The shell (`src/app/(app)/layout.tsx`) answers two questions at a glance — which branch, and where in the app — and otherwise stays out of the page's way. Content density is high: compact row heights, minimal padding between related fields, generous padding only around page-level containers.

- **Top bar** (everyone; sticky, 56px, on Card white with a Hairline bottom border, a step up from the Paper page so it reads as its own band; the staff tab bar matches): StaffTrack, then for owners and managers the **branch switcher**, and the account menu (name and role; Log out) at the right. On a wide screen the brand sits in a 14rem cell over the left bar, with the same right border, so the switcher lines up with the page's left edge.
- **Left bar** (owners and managers, `lg` up): fixed 14rem, labels always shown, grouped — *Today* (Dashboard), *Run* (Schedule, Attendance, Tasks), *Setup* (Users, Branches, Registers, Periods, Roles & coverage). The bar is Ledger Ink, and on wide screens the StaffTrack cell tops it, so the dark column runs unbroken from top to bottom. Each item is a lucide icon plus label; the active one sits on a lighter Ledger Ink step (`--sidebar-accent`, `#2A3034`) in white at weight 500, the rest at 400 — a quiet "you are here", not a colored pill. Below `lg` it becomes a slide-out sheet on the same dark surface behind a menu button in the top bar, which closes once the chosen page arrives.
- **Branch switcher** (`branch-switcher.tsx`): one choice every owner/manager page follows, kept in the `stafftrack_branch` cookie; a `?branch=` link still wins and counts as choosing that branch. "All branches" plus each branch the API scopes to the viewer; someone with one branch sees its name as plain text, not a menu. The rule lives in `src/lib/branch-selection.ts` and is shared by the pages and the switcher, so the label always names what the page shows. It is a preference, never a gate — the routes' RBAC checks are.
- **"All branches" on a per-branch page** (Schedule, Attendance, Roles & coverage): one week nav, then every branch's view stacked under its name (`branch-stack.tsx`), each foldable and with an "Only this branch" link. Pages that already list across branches (Dashboard, Users, Registers, Periods, Tasks) follow the switcher too, showing only the selected branch's rows; under "All branches" they show one combined list rather than a stack.

The login page is a single centered `Card` (`max-w-sm`) on the bare `Paper` background — deliberately the simplest possible surface, since it's the one screen with no navigation and no session yet.

Staff-facing screens drop the sidebar for a single-column, mobile-first layout with larger touch targets and one primary action per screen — these are used standing up, on a phone, mid-shift, not at a desk. Their four sections (Home, My tasks, Schedule, Attendance) are top-bar links from `md` up (the active one on a soft ink tint, `bg-foreground/8`) and a **bottom tab bar** on a phone: icon over label, 64px tall cells, the active tab's icon on the same soft ink pill, its label in semibold, clear of the home indicator, with page content padded so nothing hides behind it. Staff get no branch switcher; their pages already cover all their branches.

The staff Home (`src/components/dashboard/staff-today.tsx`) is the reference: Today, then Tomorrow, then "Missed this month" on a phone. At `lg` it becomes Today as the main column with Tomorrow and Missed time in a 20–22rem side column (same DOM order, so focus order is unchanged), and Today's task cards go two-up once that column clears `@3xl` (a container query, so the shared task list stays single-column elsewhere). Within a day, a group label sits tight above its content (`gap-1.5`) and groups separate more widely; an empty group puts its note on the label's row, and a fully empty day collapses to one line.

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
- **Everything else's focus:** text links and plain buttons with no focus style of their own get a solid 2px Market Blue outline with a 2px offset (`:focus-visible` in `globals.css`'s base layer, `outline-ring` at full opacity). The former half-opacity default measured ~2.4:1, under WCAG 1.4.11's 3:1; the solid outline is 5.3:1 on Paper. Components that set `outline-none` keep their own ring. On the dark left bar the outline turns light (`outline-sidebar-foreground`, 14:1), since blue on Ledger Ink is only 3.2:1.
- **Repeated actions:** when a list repeats the same button per item (e.g. "Take photo" on each task card), its `aria-label` starts with the visible text and adds the item ("Take photo for Restock shelves, due Sun 4 Oct").
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

### Pages and tables
- **Every page names itself.** A page exports `metadata.title` (the root layout's template adds " · StaffTrack"); the title matches the page's `h1`, and Home is "Dashboard" or "Home" by role. Nothing above the `h1` is a heading — the left bar's group labels are plain text naming their lists.
- **Skip link.** "Skip to content" is the first Tab stop on every signed-in page and moves focus to `<main id="main">`.
- **One blue per screen holds when branches stack.** A per-branch action that's primary on one branch's page (Import file) goes outline when "All branches" stacks several, so the screen never shows a row of blue buttons.
- **Tables sit on Card**, like every other panel: `rounded-lg border border-border bg-card`. Row actions are outline buttons (`cn(buttonVariants({ variant: "outline", size: "sm" }))` — without `cn` the base `border-transparent` wins and the outline disappears), a secondary action beside them ghost.
- **Role names** are stored lowercase and shown capitalized wherever they stand alone (table row headers, pickers, badges); inside a sentence ("Short: 1 cashier") they stay lowercase.

### Page forms
Every create/edit page (tasks, users, branches, registers, periods) is one `FormCard` (`src/components/layout/form-card.tsx`) on Card: `FormAlerts` on top for form-level messages, then `FormSection`s under Hairline rules — the section name in a 10rem left column from `md` up, the fields to its right — and `FormFooter` with the one primary button at the right.
- **Width follows the fields, not a fixed cap.** A form with a couple of fields is `max-w-3xl`; one with several short pickers is `max-w-5xl`, and those pickers share a row (`lg:grid-cols-3` on the section) instead of each stretching to 500px+. A date or a three-word select never takes a full row; free text (Title, Name) may.
- **Order reads left to right as it's filled in** — Branch, then Assign to, then Person — so a field another depends on comes first in the row.
- **Touch:** on a coarse pointer the card's inputs and select triggers grow to 44px; a mouse keeps the dense 32px.
- **New credentials:** a form that creates someone else's login sets `autoComplete="off"` on the phone and `new-password` on the password, so the browser doesn't fill in the signed-in manager's own.
- The roles page's "New role" stays an inline field-plus-button: it adds one row to the table above it, not a page.

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
