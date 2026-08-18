# RunMate Information Architecture Refactor Roadmap

> Historical implementation record: the canonical future target now replaces Coach with You and makes Coach contextual. See `PRODUCT_REPOSITIONING_ROADMAP.md` and `SCREEN_OWNERSHIP_MAP.md`. The completed phases below are retained as migration history.

Status: Phase 7 code complete; Phase 8 tester validation pending
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
| `/tabs/more` | `/tabs/settings` | Legacy route remains available; new internal entry points use `Settings & Data` |

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

- [x] Rename More to Settings and Data.
- [x] Move profile, notifications, Health Connect, privacy, export, diagnostics, and About into it.
- [x] Keep RunMate as the working name until store, domain, social, and preliminary trademark checks produce a viable shortlist.
- [x] Rebrand the user-facing app name, logo/icon artwork, and brand copy together while keeping `com.runmate.mobile` unchanged. Store-listing publication remains a separate release-channel task.

The final rebrand remains intentionally gated. Phase 5 changes the product structure and settings language only. The future brand release changes the display name and artwork, but preserves the existing Android application ID, package/namespace, signing identity, installed-app upgrade path, and stored data. See `PRODUCT_REPOSITIONING_ROADMAP.md`.

### Phase 6 — Navigation hardening and migration closure

- [x] Pass an explicit originating pillar when opening standalone Health, Move, Today, or Settings pages.
- [x] Give cold deep links a safe pillar fallback instead of relying on unavailable browser history.
- [x] Keep legacy `/tabs/more` and `/tabs/upload` names only as compatibility routes and regression contracts.
- [x] Remove stale user-facing More, Upload, Recovery-tab, and Activity-tab navigation labels.
- [x] Add focused regression coverage for canonical routes and back-navigation behavior.

Internal file and loader names may retain legacy terminology until a later code-only cleanup. They are not user-facing and changing them is not required for route compatibility.

### Phase 7 — Experience and performance closure

- [x] Preserve the selected Move date and unfinished Coach draft for the current app session.
- [x] Preserve Today, Health, and Move scroll positions when a primary view is remounted.
- [x] Measure real tab-transition latency on-device against a 250 ms interaction budget.
- [x] Keep constrained-network safeguards on idle tab prefetch and avoid new foreground data requests.
- [x] Normalize plan placeholders so unavailable pace values are not presented as useful training guidance.
- [x] Keep persistent visible labels on all four primary tab destinations and add focused regression coverage.
- [ ] Validate Android Back, font scaling, TalkBack, scroll restoration, and tab timing on a physical tester device.

Phase 7 code is complete when automated gates pass. Physical-device validation remains a release acceptance item and must not be inferred from browser tests or a successful Android build.

### Phase 8 — Physical-device validation and IA stabilization

Release candidate: WholeMate `1.0.0 (1221)`; Firebase App Distribution release `1kep1t2vo8qv0` delivered on 2026-08-19.

- [x] Produce a signed, v2-verified APK with read-only Health Connect access except the documented opt-in `WRITE_NUTRITION` permission.
- [x] Pass 622 unit tests across 125 files, lint, production web build, Capacitor sync, and Android release build.
- [ ] Install WholeMate over the latest RunMate tester build and verify the existing session, Health Connect permissions, local state, and account data remain intact.
- [ ] Smoke-test Today, Health, Move, You, contextual Coach, and manual Log on the physical tester device.
- [ ] Verify Android Back and cold deep links return to the correct originating pillar.
- [ ] Verify Move date continuity, Today/Health/Move scroll restoration, Coach draft restoration, and the next-day Move reset.
- [ ] Capture at least five real tab-navigation samples and confirm the rolling average remains within the 250 ms budget.
- [ ] Validate 200% font scaling, TalkBack reading order, visible focus, and 44 by 44 CSS pixel touch targets on core journeys.
- [ ] Record any device-only issue with reproduction evidence; fix only confirmed regressions and rerun the release gates.

Phase 8 exits only after tester-device evidence is recorded. A successful APK build or Firebase upload is distribution evidence, not physical-device UX acceptance.

### Next product decision gate — Brand transition

Do not schedule another feature phase immediately after Phase 8. First decide whether RunMate remains the product name or moves to a broader health identity. If a new name is selected, update the display name, logo/icon artwork, user-facing brand copy, privacy copy, diagnostics, and store listing together as one coordinated release. Keep `com.runmate.mobile` and the existing Android upgrade path unchanged.

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
