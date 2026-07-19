# RunMate Mobile UI Guidelines

Last updated: 2026-07-19

This document is the shared visual standard for every RunMate Mobile page. Read it before changing layout, typography, labels, cards, forms, or navigation. Reuse the existing visual language; do not create a separate design system for one page.

## Design Principles

1. Give each screen one obvious purpose and one visual focal point.
2. Show the decision or action before supporting detail.
3. Prefer a compact row, chip, or disclosure over a full card containing one small value.
4. Keep secondary explanations collapsed or visually quiet.
5. Never manufacture missing health data. Show `Not Available`, `Missing`, or an em dash as appropriate.
6. Preserve the cool blue and white RunMate palette. Color should communicate state, not decorate every section.

## Font Family

Use the global stack already defined in `src/theme/variables.css`:

```css
font-family: "IBM Plex Sans Thai", "IBM Plex Sans", ui-sans-serif,
  system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Do not declare a different page-level font. The Thai variant must remain first so English, Thai, numbers, and units feel consistent in mixed-language records.

## Type Scale

Use the following roles rather than choosing a new size for each component.

| Role | Size | Weight | Line height | Usage |
| --- | ---: | ---: | ---: | --- |
| Toolbar title | 16px | 800 | 1.2 | Centered page name |
| Page title | 23–25px | 700–800 | 1.15–1.2 | The screen's main purpose |
| Section title | 18–20px | 700 | 1.2–1.3 | Major content sections |
| Card title | 14–17px | 650–750 | 1.25–1.35 | One card or grouped list |
| Row title | 11–13px | 650–750 | 1.3 | Activity and settings rows |
| Large metric | 24–32px | 750–850 | 1 | Primary score or total |
| Card metric | 16–20px | 700–800 | 1.15–1.25 | Supporting values |
| Body | 11–12px | 400–550 | 1.45–1.6 | Guidance and descriptions |
| Label | 9–10px | 700–850 | 1.25 | Form labels and short metadata |
| Helper/meta | 9–10px | 400–650 | 1.4–1.5 | Dates, units, provenance, help |
| Button | 11–12px | 750–800 | 1.2 | Primary and secondary actions |
| Eyebrow | 9–10px | 800–850 | 1.2 | Section context above a heading |

Avoid text smaller than 9px. An 8px value is allowed only for very short, nonessential metadata inside a dense visualization. It must never carry an action, warning, or required explanation.

Use `clamp()` only for prominent page titles or large scores. Ordinary labels and body copy should remain predictable across devices.

## Text Case And Wording

RunMate does not use programming-style camelCase in visible text.

- Use **Title Case** for toolbar titles, page titles, section titles, card titles, navigation labels, and actions: `Sleep Details`, `Weekly Summary`, `Save Workout`.
- Use **Sentence case** for descriptions, helper text, status messages, and guidance: `Your latest sleep record is ready.`
- Render eyebrows in uppercase with CSS `text-transform: uppercase`; keep their source wording readable.
- Preserve accepted metric casing: `HR`, `HRV`, `RHR`, `VO₂ Max`, `SpO₂`, `Sleep Need`, and `Time In Bed`.
- Preserve lowercase units: `bpm`, `ms`, `km`, `kg`, `min`, `kcal`, and `min/km`.
- Prefer plain, direct wording. Remove repeated phrases that restate the heading.
- Use English for product UI. User-entered records and AI analysis may remain Thai when that is the intended content language.

Examples:

| Avoid | Use |
| --- | --- |
| `sleepDetails` | `Sleep Details` |
| `Signals available` | `Signals Available` |
| `SAVE FOR TONIGHT` in normal body UI | `Save For Tonight` |
| `Your Recovery is currently in the green zone and therefore...` | `Recovery is in the green zone. Follow your planned training.` |
| `0 km · 0 min · N/A` for rest | `Rest Day` |

## Page Shell

- Limit page content to `width: min(100%, 600px)` and center it with `margin: 0 auto`.
- Default horizontal padding is 20px; use 16px at widths of 390px or below.
- Default content top padding is 24–32px, depending on whether the page begins with an intro or a hero.
- Include bottom navigation and safe-area clearance in the bottom padding.
- Keep the background quiet (`#f4f8fc` or the existing page gradient).
- Never allow a card, calendar, or action row to clip horizontally at 360–390px.

## Toolbar

- Toolbar minimum height is 56px.
- The title is centered to the viewport, not merely between left and right controls. The global rule in `src/theme/variables.css` handles this.
- Use a 16px, weight-800 title.
- Back, close, and utility controls must have at least a 44px touch target.
- Do not put a second page title immediately below the toolbar unless it communicates the page's actual task, not just the same name again.

## Page And Section Hierarchy

A normal page follows this order:

1. Toolbar title.
2. Optional page intro: eyebrow, page title, one short supporting sentence.
3. Primary action or focal card.
4. Supporting sections.
5. Details, provenance, developer information, or destructive actions last.

Use 28–32px between major sections. Use 11–13px between a section heading and its content. An eyebrow sits 4–7px above its heading.

Do not show two equally prominent hero cards. If two blocks compete, choose one as the primary result and reduce the other to a row, chip, or collapsed detail.

## Cards

- Default radius: 17–20px. Hero cards may use 22–30px.
- Default internal padding: 14–18px. Hero cards may use 20–28px.
- Default border: use the existing pale blue border near `#d9e6f0`.
- Shadows must be soft and low contrast. A border should usually provide the structure.
- Keep a card focused on one idea. Do not stack multiple headings that repeat the same meaning.
- A single status or number should usually be a chip, inline metric, or list row—not its own large card.
- Use tinted backgrounds only for a primary state, warning, or meaningful category.
- Visually mute rows whose values are zero or unavailable; do not let them compete with populated data.

Inside metric cards, use this order:

1. Label.
2. Value and unit on one baseline.
3. Optional one-line helper.

## Lists And Rows

- Standard row touch height is at least 52px; interactive controls must expose at least a 44px target.
- Use one leading icon or date badge, one flexible copy column, optional status/provenance chip, then chevron or destructive action.
- Row titles should remain on one line where practical. Truncate long user-entered names rather than compressing every column.
- Supporting metadata should be a single concise line.
- Do not display meaningless placeholders for rest and recovery sessions. Use semantic summaries such as `Rest Day` or `30 min · Easy Recovery`.
- Keep delete controls visually secondary and separated from the navigation target.

## Forms And Actions

- Input and select height: at least 40px; primary actions: at least 47px.
- Put the label above the input with a 5–7px gap.
- Use 11–12px input text and 9–10px labels/helper text.
- Group related fields into a two-column grid only when each field remains readable on a 390px viewport. Collapse to one column when needed.
- Keep the main save action on the right or full width. Destructive actions must never use the primary blue treatment.
- Loading state belongs in the pressed control and must prevent duplicate submission.

## Metrics And Units

- Use tabular-feeling alignment and keep the unit visibly subordinate to the value.
- Do not convert a domain scale merely to make all scores look alike. For example, Workout Strain may calculate on a 0–21 scale even if a separate visual percentage is used.
- Round only for display. Preserve source precision in data and calculations.
- Format pace consistently as `5:30/km`; AI-generated pace ranges should use useful boundaries such as `5:30–6:00 min/km`.
- Missing values are not zero. Do not show `0 bpm`, `0 km`, or `0 min` unless zero is a real measured result.

## Spacing Scale

Use this shared spacing scale:

```text
4px   micro gap
8px   closely related content
12px  row/card internal grouping
16px  standard card padding
20px  page horizontal padding
24px  content block separation
32px  major section separation
```

Prefer these values over page-specific gaps such as 13px, 19px, or 27px unless optical alignment genuinely requires them.

## Color And State

- Primary text: deep navy near `#172c49`.
- Secondary text: blue-gray near `#667b92` to `#71859a`.
- Primary action/accent: existing RunMate blue (`--ion-color-primary`).
- Success/connected: teal-green.
- Warning/attention: restrained amber.
- Error/destructive: existing danger red.
- Disabled/unavailable: neutral gray with sufficient contrast.

Do not assign every card a different pastel color. Use color to indicate meaning and keep related cards in the same family.

## Accessibility And Responsive Checks

- Maintain readable contrast for body and helper text.
- Give icon-only buttons an `aria-label`.
- Do not convey status using color alone; include a label or icon.
- Respect Android and iOS safe areas.
- Check long English and Thai content for overflow.
- Verify at 390px width and at least one narrower viewport.
- Confirm the toolbar title remains visually centered when only one side has an action.

## Page Review Checklist

Before considering a layout change complete:

- [ ] The screen has one clear focal point.
- [ ] Toolbar and section hierarchy match this guide.
- [ ] Visible wording uses Title Case or Sentence case correctly.
- [ ] Body and essential helper text are at least 9px.
- [ ] Cards do not duplicate a heading, number, or status.
- [ ] Missing values are labeled honestly and are not rendered as zero.
- [ ] Touch targets are at least 44px.
- [ ] The page works at 390px without clipping.
- [ ] A before/after screenshot confirms the hierarchy improved.
- [ ] Relevant tests, `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` still pass when source code changed.

## Existing Reference Pages

Use these implementations as compositional references, while continuing to improve them toward this guide:

- `RecoveryPage`: focal score display and progressive disclosure.
- `ActivityPage`: compact mixed-record rows and daily summary.
- `UploadPage`: forms, review hierarchy, and primary/secondary actions.
- `WorkoutDetailPage`: metrics, section hierarchy, and dense visualization rows.
- `MorePage`: settings/navigation rows.

If an existing page conflicts with this document, treat this document as the target for future visual cleanup. Do not perform an app-wide mechanical CSS rewrite; migrate pages deliberately and verify each one visually.
