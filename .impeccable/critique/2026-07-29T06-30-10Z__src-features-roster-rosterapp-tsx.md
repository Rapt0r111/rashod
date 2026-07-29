---
target: roster
total_score: 27
p0_count: 0
p1_count: 3
timestamp: 2026-07-29T06-30-10Z
slug: src-features-roster-rosterapp-tsx
---
# Critique: Roster

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | Live counts, location distribution, toasts and inline errors are strong; announcements are spread across several live regions. |
| 2 | Match System / Real World | 3/4 | Rota, locations, platoons and movement history map well to the operator's domain; quick codes still require local knowledge. |
| 3 | User Control and Freedom | 3/4 | Undo, Escape, focus return and close actions work conceptually; undo is temporary and modal-first flows are frequent. |
| 4 | Consistency and Standards | 3/4 | Shared custom controls and Phosphor icons establish a system; radii, shadows and panel treatments drift across roster/admin surfaces. |
| 5 | Error Prevention | 3/4 | Pending mutations, disabled duplicate taps, conflict handling and permission states are good; high-impact location changes have no durable confirmation/undo affordance. |
| 6 | Recognition Rather Than Recall | 2/4 | Visible labels help, but compact quick codes, icon-only top actions and duplicated metric strips make meaning harder to scan. |
| 7 | Flexibility and Efficiency | 3/4 | Global search/sort, quick locations, responsive drawer and keyboard listbox behavior support expert flow; no visible shortcut or bulk-action layer is present. |
| 8 | Aesthetic and Minimalist Design | 2/4 | The palette is disciplined, but repeated cards, duplicate metrics, large shadows and multiple gradients add surface noise. |
| 9 | Error Recovery | 3/4 | Retry, inline alert, location error and undo exist; the 3.2-second toast window is short for an operational correction. |
| 10 | Help and Documentation | 2/4 | Labels and empty states exist, but quick actions and first-use workflows rely on discovery rather than contextual explanation. |
| **Total** |  | **27/40** | **Good operational foundation; focused hierarchy and interaction refinement needed.** |

## Anti-Patterns Verdict

**Start here.** The roster does not read as obviously AI-generated. Its dark indigo/orchid identity is coherent and the operational density is appropriate for a tool. The main AI-adjacent risk is not the palette; it is the repeated dashboard grammar: metric chips, bordered cards, broad shadows and gradient accents appearing in several layers at once.

**LLM assessment:** The strongest personality comes from the tablet operator bar and the compact roster controls. The weakest moments are the duplicated totals across `TopBar`, `OperatorBar` and the overview hero, plus card-heavy sections that make every block feel equally important. The visual language should become quieter by removing competition, not by making it flatter or less useful.

**Deterministic scan:** `detect.mjs --json src/features/roster/RosterApp.tsx src/features/roster/components src/components` returned `[]` with exit code 0. No automated slop findings or false positives. The manual review still flags system-level risks that the detector does not score: hierarchy duplication, responsive density, elevation drift and recall-heavy quick actions.

**Visual overlays:** Not available. Browser automation tools are not exposed in this session, so no localhost visual tab, `[Human]` overlay, or console evidence was claimed.

## Overall Impression

This is already a credible operational workspace: the operator can search globally, see distribution, move a person quickly, inspect history and undo a change. The single biggest opportunity is to make the roster answer one question faster: **who needs attention now, and what is the safest next action?** Right now that answer competes with three versions of the same summary and several equally weighted surfaces.

## What's Working

1. **Tablet-first operator bar.** `src/features/roster/components/operator-bar.tsx:41-90` keeps distribution chips and shared search/sort adjacent to the roster. This directly supports the product's core job instead of forcing navigation away from people.
2. **Strong operational feedback loop.** `src/features/roster/RosterApp.tsx:274-332` combines pending mutation state, error handling, success toast and undo. `person-views.tsx:41-82` also gives quick actions touch-sized 44px targets.
3. **Real interaction discipline.** `src/components/select-field.tsx:104-177` provides a custom listbox with keyboard navigation, focus return, Escape handling and selected state. Dialogs use focus containment and return focus instead of treating accessibility as decoration.

## Priority Issues

### [P1] Three summary layers compete for the same attention

**What:** `TopBar` shows total/rota/absent chips (`src/features/roster/components/top-bar.tsx:54-70`), `OperatorBar` repeats total/rota before location chips (`operator-bar.tsx:51-72`), and `Overview` adds hero stat cards (`main-content.tsx` overview section). The operator sees the same state in multiple visual containers before reaching the people list.

**Why it matters:** Repetition increases scan time and weakens priority. A user under time pressure cannot tell which number is actionable and which is context. It also makes the screen feel more like a generic dashboard than a calm working surface.

**Fix:** Make the top bar identity/time/navigation only. Keep actionable distribution and search in the operator bar. In the overview, replace repeated totals with one decision-oriented comparison or a filtered exception list: people not in rota, stale locations, or unresolved changes.

**Suggested command:** `$impeccable distill roster overview hierarchy`

### [P1] Narrow roster rows become a wrap puzzle

**What:** `RosterRow` switches to flex-wrap at 560px and reorders actions at 460px (`src/features/roster/components/person-views.tsx:41-82`). The row contains avatar, name/rank/number, location badge, up to four quick-location buttons and a `...` action. At the narrowest width, the user must reconstruct the person/action relationship after the row changes shape.

**Why it matters:** This is the core mutation surface. Wrapping creates vertical jitter, increases target-to-person ambiguity and makes the fastest action less predictable on small tablets/phones.

**Fix:** Preserve a stable two-zone row: identity and current location in the first zone, action rail in the second. At narrow widths collapse quick locations into one labeled "Изменить место" action or a bottom sheet; do not let the action rail reorder around identity content. Test long Russian names and four quick locations at 320, 360, 390, 768 and 1024px.

**Suggested command:** `$impeccable adapt roster rows`

### [P1] Elevation and radius vocabulary drift into ghost-card repetition

**What:** Ordinary roster cards and panels repeatedly combine `border border-line` with `shadow-(--shadow)` (`person-views.tsx:106`, `main-content.tsx:582`, `708`, `782`, `917`, `1484`). Admin surfaces also use `rounded-3xl` (`admin-panel.tsx:207`, `224`) while the roster mostly uses 15–22px radii.

**Why it matters:** The content becomes visually noisy and every section appears equally elevated. This undermines the calm, practical register and makes the actual overlay/modal hierarchy less obvious.

**Fix:** Use tonal layering plus a quiet border for ordinary panels. Reserve the wide ambient shadow for the app shell, drawer, toast and operator bar. Normalize cards to 12–16px, major sections to 16px, and use 22px only where the section boundary is genuinely structural.

**Suggested command:** `$impeccable quieter roster elevation`

### [P2] Quick location controls favor recall over recognition

**What:** Person rows render visible quick actions as `quickCode` values (`person-views.tsx:53-78`) and expose the full location only through `title` and `aria-label`; the overflow action is literal `...`.

**Why it matters:** Experienced operators may learn the codes, but a first-timer or a user switching devices must remember a code-to-location mapping. Tooltips are not reliable on touchscreens, and `...` does not explain whether it means more locations, edit, or details.

**Fix:** Keep codes only when the location label remains visible nearby or when the code is a proven local convention. Add a visible text label in the expanded action rail and replace `...` with a location-pin/edit icon plus a short label at tablet widths. Preserve the full accessible name.

**Suggested command:** `$impeccable clarify roster quick actions`

### [P2] Feedback is good but too transient and too globally announced

**What:** The toast auto-clears after 3.2 seconds (`RosterApp.tsx:285`), while the entire main workspace is `aria-live="polite"` (`RosterApp.tsx:419`) and the operator bar also announces distribution changes (`operator-bar.tsx:44-48`).

**Why it matters:** A high-impact location correction can disappear before the operator confirms it. Conversely, broad live regions can cause screen readers to re-announce large changing sections during SSE refreshes, increasing cognitive noise.

**Fix:** Keep the undo toast until dismissal, the next mutation, or a longer timeout with pause-on-hover/focus. Scope live announcements to the changed count or a dedicated status node; remove `aria-live` from the full scrollable main region.

**Suggested command:** `$impeccable harden roster feedback`

## Persona Red Flags

### Alex — Power User

- The operator bar is excellent for global search and quick location filtering.
- The primary mutation still requires scanning each row's code buttons; no visible keyboard shortcut, command path or bulk action exists.
- Repeated totals in the top bar/operator bar/overview slow the "scan → decide → move" loop.
- A 3.2-second undo toast is easy to miss during a batch of changes.

### Jordan — First-Timer

- The person row's `quickCode` buttons have no visible location labels; `title` is not a dependable touch affordance.
- The `...` button does not explain its action without exploration.
- Top-bar icon-only actions (history, export, references, fullscreen, logout) rely on tooltip/accessible-label discovery.
- No contextual explanation teaches the difference between a quick location action and the full location sheet.

### Marina — Tablet Operator

- The 44px quick actions and sticky operator bar fit touch use well.
- At 460–560px, row wrapping and action reordering can separate the person's identity from their mutation controls.
- At 900px, sidebar-to-drawer transition is sensible, but the user must switch navigation model while also managing a dense operator bar.
- Long names, ranks and custom locations need explicit regression coverage at narrow widths; `wrap-anywhere` prevents overflow but can create awkward line breaks.

## Minor Observations

- The roster has an explicit skip link, focus-visible ring and focus-managed drawers; keep these while simplifying visuals.
- Z-index values are ad hoc (`z-40`, `z-45`, `z-50`, `z-60`, `z-70`, `z-80`) across select, drawer, dialogs, alerts and toast. A semantic scale would make stacking behavior easier to reason about.
- Backdrop blur is purposeful for overlays and the operator bar, but repeated use plus translucent backgrounds can reduce edge clarity on lower-quality displays.
- The app's background radial gradients give the shell identity; keep them structural and do not spread gradients into every card or label.
- Read-only mode correctly explains access, but disabling an entire `PersonCard` when `canWrite` is false may remove useful recognition/details if read-only users need inspection.
- Empty states and retry states exist; verify that the empty roster teaches the next setup action rather than only stating absence.

## Questions to Consider

- What if the top bar stopped carrying summary numbers and became a pure orientation/control rail?
- What if every person row exposed one unmistakable action, "Изменить место", and quick codes appeared only after the operator opted into fast mode?
- What if the overview prioritized exceptions and unresolved movement instead of repeating totals already visible above the list?
