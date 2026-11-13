# UI guidelines — how Automora screens are built

Automora is an internal business tool used all day by staff. The interface should feel like a calm, dependable work tool (think Linear, Stripe Dashboard, GitHub settings), not a marketing site or a template.

## What to avoid ("AI slop")
- Gradients, glassmorphism, glows, decorative blobs, emoji, sparkle/rocket icons, purple.
- Giant rounded cards with heavy shadows; cards inside cards inside cards.
- Centred hero layouts, oversized headings, "Welcome back! 👋" copy, filler subtitles that repeat the title.
- Every element being a card. Use cards only to group a meaningful section; lists of records are tables.
- Vague copy ("Manage your stuff seamlessly"). Say exactly what the screen does and what happens next.
- Several competing primary buttons. Each screen has at most one primary (green) action.

## Foundations (already defined — use only these)
- Tokens: `src/app/globals.css` → `bg-surface`, `bg-background`, `text-foreground`, `text-muted`, `border-border`, `bg-primary`/`text-primary`/`bg-primary-soft`, `success|info|warning|danger` (+ `-soft`). Never raw hex or new colours in pages.
- Type: Inter, 14px base. Page title `text-2xl font-semibold`; section title `text-base font-semibold`; meta/help `text-xs text-muted` or `text-sm text-muted`. Numbers in tables: `tabular-nums`, right-aligned.
- Spacing on an 4/8px rhythm: `gap-2/3/4/6`, sections separated by `gap-6`. Radius `rounded-md`. Shadow at most `shadow-sm`.
- Components (`src/components/**`): `PageHeader`, `buttonClass(variant)`, `inputClass`, `Field`, `StatusBadge`, `EmptyState`, `ErrorState`, `TableSkeleton`, `ConfirmForm`/`ConfirmDialog`, `DataTable`, `KpiCard`, `BarChartCard`, form kit. Reuse them; do not restyle them per page.

## Page anatomy
1. **List page:** `PageHeader` (title, one-line purpose, the one primary action on the right) → filter row (`role="search"`, labelled controls, wraps on mobile) → `DataTable` (or a table) → pagination. Empty state says what to do next and offers the action.
2. **Detail page:** back link (`← Projects`) → header: title, code in `text-muted`, `StatusBadge`, 2–4 key facts inline → actions row (secondary buttons; destructive ones via `ConfirmForm`) → on `lg`: main column (2/3) with section cards + side column (1/3) "Details" card using a `<dl>` grid of label/value pairs. On mobile everything stacks.
3. **Form page:** `PageHeader` → single column, max width ~40rem, grouped with `fieldset`/section headings when long → every control wrapped in `Field` (label above, `*` + sr-only "required", help text, inline error) → actions at the bottom left: primary submit + "Cancel" link back. Disable submit while pending and show "Saving…". Show the server's error in a `role="alert"` box at the top of the form.
4. **Section card:** `rounded-md border border-border bg-surface p-4 shadow-sm`, `h2` `text-base font-semibold`, optional right-aligned link/action in the section header.

## Behaviour
- Four states everywhere: loading (skeleton via `loading.tsx`), empty (with next action), error (with retry), success (only after the server confirms).
- Destructive or permission-changing actions always confirm (`ConfirmForm`) and say the consequence.
- Status = icon + text (StatusBadge). Overdue in `text-danger` **with the word "overdue"**.
- Dates: show `YYYY-MM-DD` consistently (or relative only with the absolute date in `title`).
- Money: `CUR 1,234.50`, right-aligned, `tabular-nums`; currencies never summed together.
- Touch targets ≥ 40px (`min-h-10`). Visible focus (global). Every input has a label; icon-only buttons have `aria-label`.
- Works at 375 / 768 / 1280 px with no horizontal page scroll (tables scroll inside their container).

## Copy
Sentence case. Short, specific, active voice. Buttons are verbs ("Create invoice", "Record payment"). Help text explains consequences ("Issuing assigns a number and locks the lines.").
