# RunMate Information Architecture Refactor Roadmap

Status: In progress
Working product name: RunMate
Target positioning: Personal health and recovery companion

## Product question

RunMate should answer one question before exposing individual metrics:

> How is my body today, what is shaping it, and what should I do next?

Running remains a strong use case, but it is one movement module rather than the container for the whole product.

## Product pillars

| Pillar | User question | Primary content |
| --- | --- | --- |
| Today | What can my body handle today? | Body status, Recovery, Sleep, Strain, Energy Reserve, today's plan |
| Health | What is changing in my health? | Health Calendar, sleep and recovery trends, heart context, nutrition, weight, fitness age, pain |
| Move | What did I do and what is planned? | Workouts, strength, daily records, weekly plan, race goal |
| Coach | What does my data mean for this decision? | Conversational guidance, history, evidence and data gaps |

`Upload` is not a product pillar. It becomes a manual `Log` fallback for data Health Connect cannot provide or when automatic sync is unavailable. `More` becomes Settings and Data rather than a discovery container for core health features.

## Navigation target

Primary tabs:

1. Today
2. Health
3. Move
4. Coach

Secondary actions:

- `Log`: available from Today, Health, and Move; opens the existing manual intake flow.
- `Settings`: available from Health and account-level entry points.
- Detail pages remain outside the tab outlet when a focused, full-screen flow is useful.

## Route migration

| Legacy route | Canonical route | Migration behavior |
| --- | --- | --- |
| `/tabs/recovery` | `/tabs/today` | Redirect; keep native notifications and old links working |
| `/tabs/activity` | `/tabs/move` | Redirect; retain detail-page back compatibility |
| `/ai-coach` | `/tabs/coach` | Keep reachable during migration; update internal entry points progressively |
| `/tabs/upload` | `/tabs/log` | Legacy utility route remains available; new internal entry points use `Log` |
| `/tabs/more` | `/tabs/more` | Hidden settings route until it is renamed |

Do not change stored health records, Supabase schemas, Health Connect permissions, recovery formulas, or training-plan reconciliation as part of the IA refactor.

## Delivery phases

### Phase 1 — Shell and discovery

- [x] Define the four-pillar IA and compatibility policy.
- [x] Replace the bottom navigation with Today, Health, Move, and Coach.
- [x] Add a lightweight Health hub so core health features are no longer hidden in More.
- [x] Keep Upload and More reachable as utility routes.
- [x] Rename visible tab headers without renaming data models or formulas.
- [x] Add route and navigation regression tests.

### Phase 2 — Health consolidation

- [x] Group Health into Overview, Trends, Body, and Data Sources.
- [x] Move Health Calendar, Recovery Trends, Nutrition Trends, Body Weight, Fitness Age, and Pain/Injury out of More.
- [x] Add honest freshness and missing-data states to each Health entry.
- [x] Use existing startup caches; do not create duplicate Supabase loaders.

### Phase 3 — Today interpretation layer

- [x] Present one plain-language body status, one main reason, and one useful action.
- [x] Keep Recovery, Sleep, Strain, and Energy as supporting evidence rather than adding another opaque score.
- [x] Verify that recommendations never diagnose illness or invent unavailable HRV/respiratory/stress data.

### Phase 4 — Move and manual logging

- [x] Separate recorded activity from planned training without duplicating records.
- [x] Keep running, strength, walking, and other workouts first-class.
- [x] Rename Upload copy to Log and frame photo analysis as an optional intake method.
- [x] Preserve reviewed save/confirmation before any record is written.

### Phase 5 — Settings and brand transition

- [ ] Rename More to Settings and Data.
- [ ] Move profile, notifications, Health Connect, privacy, export, diagnostics, and About into it.
- [ ] Keep RunMate as the working name until store, domain, social, and preliminary trademark checks produce a viable shortlist.
- [ ] Rebrand app name, icon, package-facing copy, and store listing together; do not partially rename the product.

## Performance requirements

- Tab changes must be immediate and must not trigger unrelated Health Connect or Supabase work.
- Inactive primary tabs may be prefetched only during idle time and not on constrained/save-data connections.
- Health pages should show a valid startup snapshot first and refresh in the background.
- Long histories must use bounded recent queries with progressive archive loading.
- New load phases must be recorded in on-device performance diagnostics with explicit budgets.

## Accessibility and interaction requirements

- Every primary destination must have a persistent label; icons alone are insufficient.
- Manual Log and Settings actions require at least 44 by 44 CSS pixel targets.
- Legacy deep links and notification routes must land on a meaningful canonical destination.
- Loading, empty, stale, offline, and error states must remain distinguishable.
- Back navigation from detail pages must return to the originating pillar where known.

## Phase 1 acceptance criteria

- Exactly four primary tab destinations are visible: Today, Health, Move, Coach.
- Health Calendar, Recovery Trends, Nutrition Trends, Body Weight, Fitness Age, and Pain/Injury are discoverable from Health.
- Manual Sleep, Workout, and Meal intake remains reachable without an Upload tab.
- Existing `/tabs/recovery` and `/tabs/activity` links continue to work.
- Existing authenticated standalone detail routes remain reachable.
- Unit tests, lint, production build, and `git diff --check` pass.
